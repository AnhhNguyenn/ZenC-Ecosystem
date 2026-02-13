import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  Achievement,
  UserAchievement,
  ExerciseAttempt,
  UserVocabulary,
  Streak,
  Notification,
} from '../entities';

/**
 * GamificationService – XP tracking, level progression, and achievement engine.
 *
 * Achievement evaluation is event-driven: after qualifying actions (lesson
 * completion, exercise submission, streak update), the caller invokes
 * `checkAchievements()` which evaluates all unclaimed achievements.
 *
 * Design:
 * - Achievement conditions are JSON-serialized rules in the DB
 * - Evaluation is lazy (checked on action, not on timer)
 * - Notifications auto-created on unlock
 * - Thread-safe: unique constraint on user_achievements prevents duplicates
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(Achievement) private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement) private readonly userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(ExerciseAttempt) private readonly attemptRepo: Repository<ExerciseAttempt>,
    @InjectRepository(UserVocabulary) private readonly userVocabRepo: Repository<UserVocabulary>,
    @InjectRepository(Streak) private readonly streakRepo: Repository<Streak>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
  ) {}

  /**
   * Get user's gamification profile.
   */
  async getProfile(userId: string): Promise<{
    totalXp: number;
    level: number;
    achievements: Array<{
      id: string;
      name: string;
      rarity: string;
      unlockedAt: Date | null;
      isHidden: boolean;
    }>;
    stats: {
      exercisesCompleted: number;
      perfectScores: number;
      vocabMastered: number;
      currentStreak: number;
    };
  }> {
    // Calculate total XP from exercise attempts
    const xpResult = await this.attemptRepo
      .createQueryBuilder('ea')
      .select('SUM(ea.xpEarned)', 'totalXp')
      .where('ea.userId = :userId', { userId })
      .getRawOne();

    const totalXp = parseInt(xpResult?.totalXp || '0', 10);
    const level = this._calculateLevel(totalXp);

    // Get all achievements + user's unlocked ones
    const allAchievements = await this.achievementRepo.find({
      order: { sortOrder: 'ASC' },
    });

    const userAchievements = await this.userAchievementRepo.find({
      where: { userId },
    });

    const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

    const achievements = allAchievements
      .filter((a) => !a.isHidden || unlockedIds.has(a.id))
      .map((a) => {
        const ua = userAchievements.find((x) => x.achievementId === a.id);
        return {
          id: a.id,
          name: a.name,
          rarity: a.rarity,
          unlockedAt: ua?.unlockedAt ?? null,
          isHidden: a.isHidden && !unlockedIds.has(a.id),
        };
      });

    // Gather stats
    const exercisesCompleted = await this.attemptRepo.count({
      where: { userId },
    });

    const perfectScores = await this.attemptRepo.count({
      where: { userId, score: 100 },
    });

    const vocabMastered = await this.userVocabRepo.count({
      where: { userId, masteryLevel: MoreThanOrEqual(80) },
    });

    const streak = await this.streakRepo.findOne({ where: { userId } });

    return {
      totalXp,
      level,
      achievements,
      stats: {
        exercisesCompleted,
        perfectScores,
        vocabMastered,
        currentStreak: streak?.currentStreak ?? 0,
      },
    };
  }

  /**
   * Check and unlock any achievements the user has earned.
   *
   * Called after qualifying actions. Evaluates each unclaimed achievement's
   * condition against the user's current stats.
   *
   * Returns list of newly unlocked achievement IDs.
   */
  async checkAchievements(userId: string): Promise<string[]> {
    const allAchievements = await this.achievementRepo.find();
    const alreadyUnlocked = await this.userAchievementRepo.find({
      where: { userId },
      select: ['achievementId'],
    });
    const unlockedIds = new Set(alreadyUnlocked.map((ua) => ua.achievementId));

    const unclaimed = allAchievements.filter((a) => !unlockedIds.has(a.id));
    const newlyUnlocked: string[] = [];

    for (const achievement of unclaimed) {
      try {
        const condition = JSON.parse(achievement.conditionJson);
        const isMet = await this._evaluateCondition(userId, condition);

        if (isMet) {
          // Unlock achievement (unique constraint prevents duplicates)
          try {
            await this.userAchievementRepo.save({
              userId,
              achievementId: achievement.id,
            });

            // Create notification
            await this.notifRepo.save({
              userId,
              type: 'ACHIEVEMENT_UNLOCK',
              title: `🏆 Achievement Unlocked!`,
              body: `You've earned: ${achievement.name}`,
              iconUrl: achievement.iconUrl,
            } as any);

            newlyUnlocked.push(achievement.id);

            this.logger.log(
              `Achievement unlocked: ${achievement.name} for user ${userId}`,
            );
          } catch {
            // Unique constraint violation = already unlocked (race condition)
          }
        }
      } catch (e) {
        this.logger.error(
          `Failed to evaluate achievement ${achievement.id}: ${e}`,
        );
      }
    }

    return newlyUnlocked;
  }

  /**
   * Evaluate a single achievement condition against user stats.
   */
  private async _evaluateCondition(
    userId: string,
    condition: {
      type: string;
      threshold: number;
      comparison: string;
    },
  ): Promise<boolean> {
    let value: number;

    switch (condition.type) {
      case 'STREAK_DAYS': {
        const streak = await this.streakRepo.findOne({ where: { userId } });
        value = streak?.currentStreak ?? 0;
        break;
      }
      case 'LONGEST_STREAK': {
        const streak = await this.streakRepo.findOne({ where: { userId } });
        value = streak?.longestStreak ?? 0;
        break;
      }
      case 'EXERCISES_COMPLETED': {
        value = await this.attemptRepo.count({ where: { userId } });
        break;
      }
      case 'EXERCISES_PERFECT': {
        value = await this.attemptRepo.count({ where: { userId, score: 100 } });
        break;
      }
      case 'VOCAB_MASTERED': {
        value = await this.userVocabRepo.count({
          where: { userId, masteryLevel: MoreThanOrEqual(80) },
        });
        break;
      }
      case 'XP_TOTAL': {
        const result = await this.attemptRepo
          .createQueryBuilder('ea')
          .select('SUM(ea.xpEarned)', 'total')
          .where('ea.userId = :userId', { userId })
          .getRawOne();
        value = parseInt(result?.total || '0', 10);
        break;
      }
      case 'TOTAL_ACTIVE_DAYS': {
        const streak = await this.streakRepo.findOne({ where: { userId } });
        value = streak?.totalActiveDays ?? 0;
        break;
      }
      default:
        return false;
    }

    switch (condition.comparison) {
      case '>=':
        return value >= condition.threshold;
      case '>':
        return value > condition.threshold;
      case '=':
      case '==':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Level calculation from total XP.
   * Levels 1-10: 100 XP each. Levels 11-25: 250 XP each.
   * Levels 26-50: 500 XP each. Beyond 50: 1000 XP each.
   */
  private _calculateLevel(totalXp: number): number {
    if (totalXp < 1000) return Math.floor(totalXp / 100) + 1;
    if (totalXp < 4750) return 10 + Math.floor((totalXp - 1000) / 250);
    if (totalXp < 17250) return 25 + Math.floor((totalXp - 4750) / 500);
    return 50 + Math.floor((totalXp - 17250) / 1000);
  }
}
