import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  ExerciseAttempt,
  UserVocabulary,
  Session,
  DailyGoal,
  Streak,
  UserMistake,
} from '../entities';

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

  constructor(
    @InjectRepository(ExerciseAttempt) private readonly attemptRepo: Repository<ExerciseAttempt>,
    @InjectRepository(UserVocabulary) private readonly userVocabRepo: Repository<UserVocabulary>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(DailyGoal) private readonly goalRepo: Repository<DailyGoal>,
    @InjectRepository(Streak) private readonly streakRepo: Repository<Streak>,
    @InjectRepository(UserMistake) private readonly mistakeRepo: Repository<UserMistake>,
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

  private _calculateLevel(totalXp: number): number {
    if (totalXp < 1000) return Math.floor(totalXp / 100) + 1;
    if (totalXp < 4750) return 10 + Math.floor((totalXp - 1000) / 250);
    if (totalXp < 17250) return 25 + Math.floor((totalXp - 4750) / 500);
    return 50 + Math.floor((totalXp - 17250) / 1000);
  }
}
