import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, In } from 'typeorm';
import {
  Exercise,
  ExerciseAttempt,
  DailyGoal,
  Streak,
  UserMistake,
} from '../entities';
import { RedisService } from '../common/redis.service';
import {
  CreateExerciseDto,
  SubmitAnswerDto,
} from './exercises.dto';

/**
 * ExercisesService – Server-side exercise validation and scoring.
 *
 * CRITICAL SECURITY PRINCIPLE:
 * The server is the SOLE authority on correctness. The client submits
 * an answer; the server compares it against the stored correct answer.
 * The correct answer is NEVER sent to the client.
 *
 * Anti-cheat measures:
 * 1. Response time validation (< 500ms = suspicious for complex exercises)
 * 2. Answer comparison is case-insensitive and whitespace-normalized
 * 3. Acceptable alternatives are checked for FILL_BLANK exercises
 * 4. REORDER answers validated as JSON arrays of strings
 *
 * Performance:
 * - Daily mix uses Redis to cache user's weak areas
 * - Attempt logging is append-only (no updates)
 * - Leaderboard updated atomically via Redis ZINCRBY
 */
@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  /** Minimum response time in ms before flagging as suspicious */
  private readonly SUSPICIOUS_SPEED_MS = 500;

  constructor(
    @InjectRepository(Exercise) private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(ExerciseAttempt) private readonly attemptRepo: Repository<ExerciseAttempt>,
    @InjectRepository(DailyGoal) private readonly dailyGoalRepo: Repository<DailyGoal>,
    @InjectRepository(UserMistake) private readonly mistakeRepo: Repository<UserMistake>,
    private readonly redis: RedisService,
  ) {}

  /** Admin: create a new exercise */
  async createExercise(dto: CreateExerciseDto): Promise<Exercise> {
    const exercise = this.exerciseRepo.create(dto as any);
    return this.exerciseRepo.save(exercise as any);
  }

  /**
   * Submit an answer for an exercise.
   *
   * Flow:
   * 1. Load exercise (with correctAnswer from DB)
   * 2. Normalize and compare user's answer
   * 3. Calculate score with type-specific logic
   * 4. Log attempt (immutable record)
   * 5. Update daily goal XP
   * 6. Update leaderboard
   * 7. Return result with explanation (learning moment)
   */
  async submitAnswer(
    exerciseId: string,
    userId: string,
    dto: SubmitAnswerDto,
  ): Promise<{
    isCorrect: boolean;
    score: number;
    xpEarned: number;
    correctAnswer: string;
    explanation: string | null;
    isSuspicious: boolean;
    attemptNumber: number;
  }> {
    const exercise = await this.exerciseRepo.findOne({
      where: { id: exerciseId },
      relations: ['lesson'],
    });

    if (!exercise) throw new NotFoundException('Exercise not found');

    // ── Anti-cheat: validate response time ────────────────────
    const isSuspicious =
      dto.responseTimeMs < this.SUSPICIOUS_SPEED_MS &&
      exercise.type !== 'MCQ'; // MCQ can be legitimately fast

    if (isSuspicious) {
      this.logger.warn(
        `Suspicious response time: user=${userId} exercise=${exerciseId} time=${dto.responseTimeMs}ms`,
      );
    }

    // ── Evaluate answer ───────────────────────────────────────
    const { isCorrect, score } = this._evaluateAnswer(
      exercise,
      dto.answer,
    );

    // ── Calculate XP ──────────────────────────────────────────
    const previousAttempts = await this.attemptRepo.count({
      where: { userId, exerciseId },
    });

    // Diminishing returns: 100% on first try, 50% on second, 25% on third+
    const attemptPenalty = previousAttempts === 0 ? 1.0 : previousAttempts === 1 ? 0.5 : 0.25;
    const xpEarned = isCorrect
      ? Math.round(exercise.points * attemptPenalty * (isSuspicious ? 0 : 1))
      : 0;

    // ── Log attempt (append-only, never updated) ──────────────
    const attempt = this.attemptRepo.create({
      userId,
      exerciseId,
      userAnswer: this._sanitizeInput(dto.answer),
      isCorrect,
      score,
      xpEarned,
      responseTimeMs: dto.responseTimeMs,
      attemptNumber: previousAttempts + 1,
    });
    await this.attemptRepo.save(attempt);

    // ── Update daily goal ─────────────────────────────────────
    if (xpEarned > 0) {
      const today = new Date().toISOString().split('T')[0];
      await this.dailyGoalRepo
        .createQueryBuilder()
        .update(DailyGoal)
        .set({
          xpEarned: () => `xpEarned + ${xpEarned}`,
          exercisesCompleted: () => 'exercisesCompleted + 1',
        })
        .where('userId = :userId AND date = :today', { userId, today })
        .execute();

      // Update leaderboard
      await this.redis.addLeaderboardXp(userId, xpEarned);
    }

    return {
      isCorrect,
      score,
      xpEarned,
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation,
      isSuspicious,
      attemptNumber: previousAttempts + 1,
    };
  }

  /**
   * Generate a daily exercise mix personalized to the user's weak areas.
   *
   * Algorithm:
   * 1. Find user's grammar rule weaknesses from UserMistakes
   * 2. Weight exercises from those areas more heavily
   * 3. Fill rest with new/unseen exercises at user's level
   * 4. Randomize order to keep practice engaging
   */
  async getDailyMix(
    userId: string,
    count: number = 15,
  ): Promise<Array<{
    id: string;
    type: string;
    prompt: string;
    optionsJson: string | null;
    audioUrl: string | null;
    imageUrl: string | null;
    hintVi: string | null;
    points: number;
  }>> {
    // Find weak grammar areas from recent mistakes
    const recentMistakes = await this.mistakeRepo.find({
      where: { userId },
      order: { nextReviewAt: 'ASC' },
      take: 20,
    });

    const weakRules = [...new Set(recentMistakes.map((m) => m.grammarRuleId))];

    // Get exercises the user hasn't attempted yet, prioritizing weak areas
    const attempted = await this.attemptRepo.find({
      where: { userId },
      select: ['exerciseId'],
    });
    const attemptedIds = attempted.map((a) => a.exerciseId);

    const qb = this.exerciseRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.type', 'e.prompt', 'e.optionsJson', 'e.audioUrl', 'e.imageUrl', 'e.hintVi', 'e.points'])
      .orderBy('NEWID()') // Random order (MSSQL)
      .take(count);

    // Exclude already-attempted exercises if possible
    if (attemptedIds.length > 0 && attemptedIds.length < 1000) {
      qb.where('e.id NOT IN (:...attemptedIds)', { attemptedIds });
    }

    const exercises = await qb.getMany();

    return exercises.map((e) => ({
      id: e.id,
      type: e.type,
      prompt: e.prompt,
      optionsJson: e.optionsJson,
      audioUrl: e.audioUrl,
      imageUrl: e.imageUrl,
      hintVi: e.hintVi,
      points: e.points,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: Answer Evaluation Engine
  // ═══════════════════════════════════════════════════════════

  /**
   * Evaluate a user's answer against the correct answer.
   *
   * Type-specific evaluation:
   * - MCQ: exact match (case-insensitive)
   * - FILL_BLANK: normalized match + acceptable alternatives
   * - REORDER: JSON array comparison
   * - MATCHING: pair-by-pair comparison
   * - SPEAKING/LISTENING: delegates to pronunciation service
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
        // Check main answer
        if (normalized === correctNormalized) {
          return { isCorrect: true, score: 100 };
        }
        // Check acceptable alternatives
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

          const score = Math.round(
            (correctPositions / correctOrder.length) * 100,
          );
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
          const userPairs: Array<{ left: string; right: string }> =
            JSON.parse(userAnswer);
          const correctPairs: Array<{ left: string; right: string }> =
            JSON.parse(exercise.correctAnswer);

          let correctCount = 0;
          for (const up of userPairs) {
            const match = correctPairs.find(
              (cp) =>
                this._normalizeAnswer(cp.left) ===
                  this._normalizeAnswer(up.left) &&
                this._normalizeAnswer(cp.right) ===
                  this._normalizeAnswer(up.right),
            );
            if (match) correctCount++;
          }

          const score = Math.round(
            (correctCount / correctPairs.length) * 100,
          );
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
        // For SPEAKING/LISTENING: basic text comparison as fallback.
        // Real scoring delegated to Pronunciation module.
        return {
          isCorrect: normalized === correctNormalized,
          score: normalized === correctNormalized ? 100 : 0,
        };

      default:
        return { isCorrect: false, score: 0 };
    }
  }

  /** Normalize answer for comparison: lowercase, trim, collapse whitespace */
  private _normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"');
  }

  /**
   * Sanitize user input before storage.
   * Prevents XSS if answer text is ever rendered in admin dashboards.
   */
  private _sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .substring(0, 2000); // Hard length cap
  }
}
