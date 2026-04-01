import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import {
  Exercise,
  ExerciseAttempt,
  UserVocabulary,
  Session,
  DailyGoal,
  Streak,
  UserMistake,
} from '../entities';
import { RedisService } from '../common/redis.service';
import { SubmitAnswerItemDto } from './progress.dto';

/**
 * ProgressService – Aggregated learning analytics dashboard.
 *
 * Computes comprehensive progress metrics from exercise attempts,
 * vocabulary mastery, session history, and streaks.
 *
 * Performance:
 * - Expensive aggregation queries are bounded by date ranges
 * - Results can be cached in Redis for 15-minute windows
 * - Skill radar computation uses weighted averaging
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  /** Minimum response time in ms before flagging as suspicious */
  private readonly SUSPICIOUS_SPEED_MS = 500;

  constructor(
    @InjectRepository(ExerciseAttempt) private readonly attemptRepo: Repository<ExerciseAttempt>,
    @InjectRepository(UserVocabulary) private readonly userVocabRepo: Repository<UserVocabulary>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(DailyGoal) private readonly goalRepo: Repository<DailyGoal>,
    @InjectRepository(Streak) private readonly streakRepo: Repository<Streak>,
    @InjectRepository(UserMistake) private readonly mistakeRepo: Repository<UserMistake>,
    @InjectRepository(Exercise) private readonly exerciseRepo: Repository<Exercise>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get comprehensive progress dashboard.
   */
  async getDashboard(userId: string): Promise<{
    overview: {
      totalXp: number;
      level: number;
      currentStreak: number;
      totalLessons: number;
      totalExercises: number;
      overallAccuracy: number;
      totalVoiceMinutes: number;
      vocabMastered: number;
    };
    skillRadar: {
      grammar: number;
      vocabulary: number;
      speaking: number;
      listening: number;
      reading: number;
    };
    weeklyActivity: Array<{
      date: string;
      xpEarned: number;
      exercisesDone: number;
      isGoalMet: boolean;
    }>;
    recentMistakes: Array<{
      grammarRuleId: string;
      count: number;
    }>;
  }> {
    // ── Overview Stats ────────────────────────────────────────
    const xpResult = await this.attemptRepo
      .createQueryBuilder('ea')
      .select('SUM(ea.xpEarned)', 'totalXp')
      .addSelect('COUNT(*)', 'totalExercises')
      .addSelect('AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END)', 'accuracy')
      .where('ea.userId = :userId', { userId })
      .getRawOne();

    const totalXp = parseInt(xpResult?.totalXp || '0', 10);
    const totalExercises = parseInt(xpResult?.totalExercises || '0', 10);
    const overallAccuracy = parseFloat(xpResult?.accuracy || '0');

    const streak = await this.streakRepo.findOne({ where: { userId } });
    const vocabMastered = await this.userVocabRepo.count({
      where: { userId, masteryLevel: MoreThanOrEqual(80) },
    });

    // Voice session minutes
    const sessionResult = await this.sessionRepo
      .createQueryBuilder('s')
      .select('SUM(DATEDIFF(MINUTE, s.startTime, s.endTime))', 'totalMinutes')
      .where('s.userId = :userId AND s.endTime IS NOT NULL', { userId })
      .getRawOne();
    const totalVoiceMinutes = parseInt(sessionResult?.totalMinutes || '0', 10);

    // ── Skill Radar ───────────────────────────────────────────
    const skillRadar = await this._computeSkillRadar(userId);

    // ── Weekly Activity ───────────────────────────────────────
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const goals = await this.goalRepo.find({
      where: {
        userId,
        date: MoreThanOrEqual(weekAgo.toISOString().split('T')[0]),
      },
      order: { date: 'ASC' },
    });

    const weeklyActivity = goals.map((g) => ({
      date: g.date,
      xpEarned: g.xpEarned,
      exercisesDone: g.exercisesCompleted,
      isGoalMet: g.isCompleted,
    }));

    // ── Recent Mistake Patterns ───────────────────────────────
    const mistakes = await this.mistakeRepo
      .createQueryBuilder('m')
      .select('m.grammarRuleId', 'grammarRuleId')
      .addSelect('COUNT(*)', 'count')
      .where('m.userId = :userId', { userId })
      .groupBy('m.grammarRuleId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      overview: {
        totalXp,
        level: this._calculateLevel(totalXp),
        currentStreak: streak?.currentStreak ?? 0,
        totalLessons: streak?.totalActiveDays ?? 0,
        totalExercises,
        overallAccuracy: Math.round(overallAccuracy * 10) / 10,
        totalVoiceMinutes,
        vocabMastered,
      },
      skillRadar,
      weeklyActivity,
      recentMistakes: mistakes.map((m: { grammarRuleId: string; count: string }) => ({
        grammarRuleId: m.grammarRuleId,
        count: parseInt(m.count, 10),
      })),
    };
  }

  /**
   * Compute skill radar scores (0-100) across 5 dimensions.
   *
   * Each skill is computed from relevant exercise types:
   * - Grammar: MCQ + FILL_BLANK exercises with grammar tags
   * - Vocabulary: vocab mastery % + vocab-type exercises
   * - Speaking: voice session count + SPEAKING exercise scores
   * - Listening: LISTENING exercise accuracy
   * - Reading: FILL_BLANK + REORDER exercise accuracy
   */
  private async _computeSkillRadar(userId: string): Promise<{
    grammar: number;
    vocabulary: number;
    speaking: number;
    listening: number;
    reading: number;
  }> {
    const computeSkillScore = async (types: string[]): Promise<number> => {
      const result = await this.attemptRepo
        .createQueryBuilder('ea')
        .innerJoin('ea.exercise', 'e')
        .select('AVG(ea.score)', 'avgScore')
        .where('ea.userId = :userId', { userId })
        .andWhere('e.type IN (:...types)', { types })
        .getRawOne();

      return Math.round(parseFloat(result?.avgScore || '0'));
    };

    const [grammar, speaking, listening, reading] = await Promise.all([
      computeSkillScore(['MCQ', 'FILL_BLANK']),
      computeSkillScore(['SPEAKING']),
      computeSkillScore(['LISTENING']),
      computeSkillScore(['REORDER', 'MATCHING']),
    ]);

    // Vocabulary score from mastery percentage
    const totalVocab = await this.userVocabRepo.count({ where: { userId } });
    const masteredVocab = await this.userVocabRepo.count({
      where: { userId, masteryLevel: MoreThanOrEqual(80) },
    });
    const vocabulary = totalVocab > 0
      ? Math.round((masteredVocab / totalVocab) * 100)
      : 0;

    return { grammar, vocabulary, speaking, listening, reading };
  }

  /**
   * Evaluate a user's answer against the correct answer.
   */
  private _evaluateAnswer(
    exercise: Exercise,
    userAnswer: string,
  ): { isCorrect: boolean; score: number } {
    const normalized = this._normalizeAnswer(userAnswer);
    const correctNormalized = this._normalizeAnswer(exercise.correctAnswer);

    switch (exercise.type) {
      case 'MCQ':
        return {
          isCorrect: normalized === correctNormalized,
          score: normalized === correctNormalized ? 100 : 0,
        };

      case 'FILL_BLANK': {
        if (normalized === correctNormalized) {
          return { isCorrect: true, score: 100 };
        }
        if (exercise.acceptableAnswersJson) {
          try {
            const alternatives: string[] = JSON.parse(exercise.acceptableAnswersJson);
            const found = alternatives.some(
              (alt) => this._normalizeAnswer(alt) === normalized,
            );
            if (found) return { isCorrect: true, score: 100 };
          } catch {
            // Malformed JSON – ignore alternatives
          }
        }
        return { isCorrect: false, score: 0 };
      }

      case 'REORDER': {
        try {
          const userOrder: string[] = JSON.parse(userAnswer);
          const correctOrder: string[] = JSON.parse(exercise.correctAnswer);

          if (userOrder.length !== correctOrder.length) {
            return { isCorrect: false, score: 0 };
          }

          let correctPositions = 0;
          for (let i = 0; i < correctOrder.length; i++) {
            if (
              this._normalizeAnswer(userOrder[i]) ===
              this._normalizeAnswer(correctOrder[i])
            ) {
              correctPositions++;
            }
          }

          const score = Math.round((correctPositions / correctOrder.length) * 100);
          return {
            isCorrect: score === 100,
            score,
          };
        } catch {
          return { isCorrect: false, score: 0 };
        }
      }

      case 'MATCHING': {
        try {
          const userPairs: Array<{ left: string; right: string }> = JSON.parse(userAnswer);
          const correctPairs: Array<{ left: string; right: string }> = JSON.parse(exercise.correctAnswer);

          let correctCount = 0;
          for (const up of userPairs) {
            const match = correctPairs.find(
              (cp) =>
                this._normalizeAnswer(cp.left) === this._normalizeAnswer(up.left) &&
                this._normalizeAnswer(cp.right) === this._normalizeAnswer(up.right),
            );
            if (match) correctCount++;
          }

          const score = Math.round((correctCount / correctPairs.length) * 100);
          return {
            isCorrect: score === 100,
            score,
          };
        } catch {
          return { isCorrect: false, score: 0 };
        }
      }

      case 'SPEAKING':
      case 'LISTENING':
        return {
          isCorrect: normalized === correctNormalized,
          score: normalized === correctNormalized ? 100 : 0,
        };

      default:
        return { isCorrect: false, score: 0 };
    }
  }

  private _normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"');
  }

  private _sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .substring(0, 2000);
  }

  /**
   * Submit progress and calculate XP based strictly on server-side answers.
   */
  async submitProgressAndCalculateXp(
    userId: string,
    lessonId: string,
    answers: SubmitAnswerItemDto[]
  ): Promise<{ xpEarned: number }> {
    if (answers.length === 0) {
      return { xpEarned: 0 };
    }

    // Phase 2: Idempotency Key against Race Conditions & Spam
    // A single user cannot submit the same lesson progress concurrently
    const idempotencyKey = `submit_lesson:${userId}:${lessonId}`;
    const acquired = await this.redis.getClient().setnx(idempotencyKey, '1');
    if (acquired === 0) {
      this.logger.warn(`Idempotency rejected: User ${userId} is submitting lesson ${lessonId} concurrently.`);
      // Return fake success to confuse spam tool
      return { xpEarned: 0 };
    }

    // Set expiration for idempotency lock
    await this.redis.getClient().expire(idempotencyKey, 3600); // Lock for 1 hour to prevent sequential spam

    try {

    const exerciseIds = answers.map((a) => a.exerciseId);
    const exercises = await this.exerciseRepo.find({
      where: { id: In(exerciseIds) }
    });

    const exerciseMap = new Map<string, Exercise>();
    for (const ex of exercises) {
      exerciseMap.set(ex.id, ex);
    }

    let totalXpEarned = 0;
    const attemptRecords = [];

    // Calculate XP securely on the backend
    for (const ans of answers) {
      const exercise = exerciseMap.get(ans.exerciseId);
      if (!exercise || exercise.lessonId !== lessonId) {
        // Skip invalid exercises or those not belonging to the given lesson
        continue;
      }

      const isSuspicious = ans.responseTimeMs < this.SUSPICIOUS_SPEED_MS && exercise.type !== 'MCQ';

      const { isCorrect, score } = this._evaluateAnswer(exercise, ans.answer);

      // Assume this is their first attempt for the lesson bulk submit
      // (a real system might do `count` on previous attempts, but we keep it fast here)
      const attemptPenalty = 1.0;
      const xpEarned = isCorrect
        ? Math.round(exercise.points * attemptPenalty * (isSuspicious ? 0 : 1))
        : 0;

      totalXpEarned += xpEarned;

      const attempt = this.attemptRepo.create({
        userId,
        exerciseId: exercise.id,
        userAnswer: this._sanitizeInput(ans.answer),
        isCorrect,
        score,
        xpEarned,
        responseTimeMs: ans.responseTimeMs,
        attemptNumber: 1, // Simplified for batch
      });
      attemptRecords.push(attempt);
    }

    if (attemptRecords.length > 0) {
      await this.attemptRepo.save(attemptRecords);
    }

    if (totalXpEarned > 0) {
      const today = new Date().toISOString().split('T')[0];

      // Atomic Update for DailyGoal to prevent race conditions
      await this.goalRepo
        .createQueryBuilder()
        .update(DailyGoal)
        .set({
          xpEarned: () => `"xpEarned" + ${totalXpEarned}`,
          exercisesCompleted: () => `"exercisesCompleted" + ${answers.length}`,
        })
        .where('userId = :userId AND date = :today', { userId, today })
        .execute();

      // Atomic Update for User totalXp
      const { User } = require('../entities');
      await this.attemptRepo.manager
        .createQueryBuilder()
        .update(User)
        .set({
          totalXp: () => `"totalXp" + ${totalXpEarned}`,
        })
        .where('id = :userId', { userId })
        .execute();

      await this.redis.addLeaderboardXp(userId, totalXpEarned);
    }

    this.logger.log(`User ${userId} earned ${totalXpEarned} XP for lesson ${lessonId}`);

    return { xpEarned: totalXpEarned };
    } catch (e) {
      // Only delete the idempotency lock if an actual error occurred,
      // allowing the user to legitimately retry the submission.
      // On success, the lock remains for 3600s to prevent double submissions.
      await this.redis.getClient().del(idempotencyKey);
      throw e;
    }
  }

  private _calculateLevel(totalXp: number): number {
    if (totalXp < 1000) return Math.floor(totalXp / 100) + 1;
    if (totalXp < 4750) return 10 + Math.floor((totalXp - 1000) / 250);
    if (totalXp < 17250) return 25 + Math.floor((totalXp - 4750) / 500);
    return 50 + Math.floor((totalXp - 17250) / 1000);
  }
}
