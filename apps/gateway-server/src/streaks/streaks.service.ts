import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Streak, DailyGoal } from '../entities';
import { RedisService } from '../common/redis.service';

/**
 * StreaksService – Daily streak tracking and daily goal management.
 *
 * Streak logic:
 * - Activity on consecutive calendar days extends the streak
 * - Missing a day resets to 0 (unless a freeze is used)
 * - PRO users get 1 freeze/week, UNLIMITED get 3
 * - Streak freeze must be explicitly activated BEFORE the day ends
 *
 * Daily goals:
 * - Lazy-initialized on first activity each day
 * - XP target configurable: CASUAL(10), REGULAR(20), SERIOUS(50), INSANE(100)
 */
@Injectable()
export class StreaksService {
  private readonly logger = new Logger(StreaksService.name);

  constructor(
    @InjectRepository(Streak) private readonly streakRepo: Repository<Streak>,
    @InjectRepository(DailyGoal) private readonly goalRepo: Repository<DailyGoal>,
    private readonly redis: RedisService,
  ) {}

  /** Get current streak status */
  async getStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
    freezesRemaining: number;
    totalActiveDays: number;
    isActiveToday: boolean;
  }> {
    let streak = await this.streakRepo.findOne({ where: { userId } });

    if (!streak) {
      streak = this.streakRepo.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        freezesRemaining: 0,
      });
      streak = await this.streakRepo.save(streak);
    }

    const today = new Date().toISOString().split('T')[0];
    const isActiveToday = streak.lastActiveDate === today;

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      freezesRemaining: streak.freezesRemaining,
      totalActiveDays: streak.totalActiveDays,
      isActiveToday,
    };
  }

  /**
   * Use a streak freeze to preserve streak without activity.
   * Can only be used if:
   * 1. User has freezes remaining
   * 2. Hasn't used a freeze today
   * 3. Not already active today (no need to freeze)
   */
  async useFreeze(userId: string): Promise<{ success: boolean; freezesRemaining: number }> {
    const streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) throw new NotFoundException('Streak not found');

    const today = new Date().toISOString().split('T')[0];

    if (streak.freezesRemaining <= 0) {
      throw new BadRequestException('No streak freezes remaining');
    }

    if (streak.lastActiveDate === today) {
      throw new BadRequestException('Already active today – no freeze needed');
    }

    if (streak.lastFreezeUsedAt === today) {
      throw new BadRequestException('Already used a freeze today');
    }

    streak.freezesRemaining -= 1;
    streak.lastFreezeUsedAt = today;
    streak.lastActiveDate = today; // Count frozen day as active
    await this.streakRepo.save(streak);

    this.logger.log(`Streak freeze used by ${userId}. Remaining: ${streak.freezesRemaining}`);

    return {
      success: true,
      freezesRemaining: streak.freezesRemaining,
    };
  }

  /** Get today's daily goal, creating if needed */
  async getDailyGoal(userId: string): Promise<DailyGoal> {
    const today = new Date().toISOString().split('T')[0];

    let goal = await this.goalRepo.findOne({ where: { userId, date: today } });

    if (!goal) {
      goal = this.goalRepo.create({
        userId,
        date: today,
        xpTarget: 20, // Default: REGULAR
      });
      goal = await this.goalRepo.save(goal);
    }

    return goal;
  }

  /** Update daily XP target */
  async setDailyTarget(
    userId: string,
    xpTarget: number,
  ): Promise<DailyGoal> {
    const validTargets = [10, 20, 50, 100];
    if (!validTargets.includes(xpTarget)) {
      throw new BadRequestException(
        `XP target must be one of: ${validTargets.join(', ')}`,
      );
    }

    const today = new Date().toISOString().split('T')[0];
    let goal = await this.goalRepo.findOne({ where: { userId, date: today } });

    if (!goal) {
      goal = this.goalRepo.create({ userId, date: today, xpTarget });
    } else {
      goal.xpTarget = xpTarget;
    }

    return this.goalRepo.save(goal);
  }

  /** Get week's daily goal history for progress chart */
  async getWeekHistory(userId: string): Promise<DailyGoal[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    return this.goalRepo
      .createQueryBuilder('dg')
      .where('dg.userId = :userId', { userId })
      .andWhere('dg.date >= :weekAgo', { weekAgo: weekAgoStr })
      .orderBy('dg.date', 'ASC')
      .getMany();
  }
}
