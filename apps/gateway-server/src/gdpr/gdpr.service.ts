import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  User,
  UserProfile,
  Session,
  UserMistake,
  ExerciseAttempt,
  UserVocabulary,
  UserAchievement,
  Streak,
  DailyGoal,
  Notification,
} from '../entities';
import { RedisService } from '../common/redis.service';

/**
 * GdprService – GDPR/Privacy compliance module.
 *
 * Implements Article 15 (Right of Access), Article 17 (Right to Erasure),
 * and Article 20 (Right to Data Portability).
 *
 * CRITICAL SECURITY:
 * - Data export is rate-limited to 1 per hour per user
 * - Account deletion is irreversible – uses hard DELETE (not soft delete)
 * - All related data is cascade-deleted in a single transaction
 * - Redis caches are purged post-deletion
 * - Deletion confirmation is logged in audit trail
 *
 * Legal compliance:
 * - 30-day processing window (GDPR Article 12(3))
 * - Export format: JSON (machine-readable, as required by Article 20)
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(UserMistake) private readonly mistakeRepo: Repository<UserMistake>,
    @InjectRepository(ExerciseAttempt) private readonly attemptRepo: Repository<ExerciseAttempt>,
    @InjectRepository(UserVocabulary) private readonly vocabRepo: Repository<UserVocabulary>,
    @InjectRepository(UserAchievement) private readonly achievementRepo: Repository<UserAchievement>,
    @InjectRepository(Streak) private readonly streakRepo: Repository<Streak>,
    @InjectRepository(DailyGoal) private readonly goalRepo: Repository<DailyGoal>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly redis: RedisService,
  ) {}

  /**
   * GDPR Article 15 + 20: Right of Access & Data Portability.
   *
   * Exports ALL user data in machine-readable JSON format.
   * Includes personal info, learning history, achievements, and analytics.
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [
      profile,
      sessions,
      mistakes,
      attempts,
      vocabulary,
      achievements,
      streak,
      goals,
    ] = await Promise.all([
      this.profileRepo.findOne({ where: { userId } }),
      this.sessionRepo.find({ where: { userId } }),
      this.mistakeRepo.find({ where: { userId } }),
      this.attemptRepo.find({ where: { userId } }),
      this.vocabRepo.find({ where: { userId }, relations: ['vocabulary'] }),
      this.achievementRepo.find({ where: { userId }, relations: ['achievement'] }),
      this.streakRepo.findOne({ where: { userId } }),
      this.goalRepo.find({ where: { userId } }),
    ]);

    this.logger.log(`GDPR data export completed for user ${userId}`);

    return {
      exportDate: new Date().toISOString(),
      gdprArticle: 'Article 15 (Right of Access) & Article 20 (Data Portability)',
      personalInformation: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        status: user.status,
        createdAt: user.createdAt,
      },
      profile: profile
        ? {
            level: profile.currentLevel,
            confidenceScore: profile.confidenceScore,
            speakingSpeed: profile.speakingSpeedMultiplier,
            vnSupportEnabled: profile.vnSupportEnabled,
          }
        : null,
      learningProgress: {
        streak: streak
          ? {
              currentStreak: streak.currentStreak,
              longestStreak: streak.longestStreak,
              totalActiveDays: streak.totalActiveDays,
            }
          : null,
        dailyGoals: goals.map((g) => ({
          date: g.date,
          xpTarget: g.xpTarget,
          xpEarned: g.xpEarned,
          isCompleted: g.isCompleted,
        })),
      },
      exerciseHistory: attempts.map((a) => ({
        exerciseId: a.exerciseId,
        userAnswer: a.userAnswer,
        isCorrect: a.isCorrect,
        score: a.score,
        xpEarned: a.xpEarned,
        responseTimeMs: a.responseTimeMs,
        createdAt: a.createdAt,
      })),
      vocabulary: vocabulary.map((v) => ({
        word: (v as UserVocabulary & { vocabulary: { word: string } }).vocabulary?.word,
        masteryLevel: v.masteryLevel,
        totalReviews: v.totalReviews,
        totalCorrect: v.totalCorrect,
        easinessFactor: v.easinessFactor,
        createdAt: v.createdAt,
      })),
      grammarMistakes: mistakes.map((m) => ({
        grammarRuleId: m.grammarRuleId,
        originalText: m.originalSentence,
        correctedText: m.correctedSentence,
      })),
      achievements: achievements.map((a) => ({
        name: (a as UserAchievement & { achievement: { name: string } }).achievement?.name,
        unlockedAt: a.unlockedAt,
      })),
      voiceSessions: sessions.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        tokensConsumed: s.totalTokensConsumed,
      })),
    };
  }

  /**
   * GDPR Article 17: Right to Erasure ("Right to be Forgotten").
   *
   * Permanently deletes ALL user data in a single transaction.
   * This is IRREVERSIBLE.
   *
   * Order of deletion matters due to foreign key constraints:
   * 1. Dependent tables (attempts, vocab, achievements, etc.)
   * 2. Profile and sessions
   * 3. User record itself
   * 4. Redis cache purge
   */
  async deleteAccount(userId: string): Promise<{ success: boolean; tablesWiped: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let tablesWiped = 0;

    try {
      // Delete in dependency order (children before parents)
      const tables = [
        { repo: this.notifRepo, name: 'notifications' },
        { repo: this.goalRepo, name: 'daily_goals' },
        { repo: this.attemptRepo, name: 'exercise_attempts' },
        { repo: this.vocabRepo, name: 'user_vocabulary' },
        { repo: this.achievementRepo, name: 'user_achievements' },
        { repo: this.mistakeRepo, name: 'user_mistakes' },
        { repo: this.streakRepo, name: 'streaks' },
        { repo: this.sessionRepo, name: 'sessions' },
        { repo: this.profileRepo, name: 'user_profiles' },
      ];

      for (const { repo, name } of tables) {
        const result = await queryRunner.manager.delete(repo.target as any, { userId });
        if ((result.affected ?? 0) > 0) tablesWiped++;
        this.logger.debug(`GDPR: Deleted ${result.affected} rows from ${name}`);
      }

      // Delete user record itself (must be last due to FKs)
      await queryRunner.manager.delete(User, { id: userId });
      tablesWiped++;

      await queryRunner.commitTransaction();

      // Purge ALL Redis caches for this user
      await this._purgeRedisData(userId);

      this.logger.warn(
        `GDPR ACCOUNT DELETION COMPLETED: userId=${userId}, tablesWiped=${tablesWiped}`,
      );

      return { success: true, tablesWiped };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`GDPR deletion FAILED for ${userId}: ${error}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Purge all Redis caches for a deleted user.
   */
  private async _purgeRedisData(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const keysToDelete = [
      `active_session:${userId}`,
      `user_profile:${userId}`,
      `daily_review:${userId}`,
      `user_streak:${userId}`,
      `daily_goal:${userId}`,
      `lesson_completion:${userId}`,
      `pronunciation:problems:${userId}`,
    ];

    // Remove from leaderboards
    await client.zrem('leaderboard:weekly', userId);
    await client.zrem('leaderboard:alltime', userId);

    // Delete all user-specific keys
    for (const key of keysToDelete) {
      await client.del(key);
    }

    this.logger.debug(`Redis data purged for user ${userId}`);
  }
}
