import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { RedisService } from '../common/redis.service';
import { GrantDto } from './admin.dto';

/**
 * AdminService – Business logic for "God Mode" admin operations.
 *
 * Design decisions:
 * - Every mutation follows the pattern: Update SQL → Log audit → Invalidate Redis.
 * - Redis cache invalidation is performed IMMEDIATELY after the SQL update
 *   to prevent stale data from being served to active voice sessions.
 * - The change snapshot captures before/after state for full audit traceability.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Grant tier upgrade, tokens, or status change to a user.
   *
   * Flow:
   * 1. Load target user (fail fast if not found)
   * 2. Capture before-state snapshot
   * 3. Apply changes to SQL
   * 4. Write audit log (append-only)
   * 5. Invalidate Redis cache immediately (critical for active sessions)
   *
   * @param adminId - UUID of the admin performing the action
   * @param targetUserId - UUID of the user being modified
   * @param dto - Changes to apply + mandatory reason
   * @returns Updated user record
   */
  async grantToUser(
    adminId: string,
    targetUserId: string,
    dto: GrantDto,
  ): Promise<User> {
    try {
      // ── Step 1: Load target user ────────────────────────────────
      const user = await this.userRepo.findOne({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException(`User ${targetUserId} not found`);
      }

      // ── Step 2: Capture before-state for audit ──────────────────
      const beforeState = {
        tier: user.tier,
        tokenBalance: user.tokenBalance,
        status: user.status,
      };

      // ── Step 3: Apply changes ───────────────────────────────────
      const actions: string[] = [];

      if (dto.tier) {
        user.tier = dto.tier;
        actions.push(`CHANGE_TIER:${beforeState.tier}->${dto.tier}`);
      }

      if (dto.tokenGrant !== undefined) {
        user.tokenBalance += dto.tokenGrant;
        actions.push(`GRANT_TOKENS:+${dto.tokenGrant}`);
      }

      if (dto.status) {
        user.status = dto.status;
        actions.push(`CHANGE_STATUS:${beforeState.status}->${dto.status}`);
      }

      const savedUser = await this.userRepo.save(user);

      // ── Step 4: Write audit log (append-only) ───────────────────
      const afterState = {
        tier: savedUser.tier,
        tokenBalance: savedUser.tokenBalance,
        status: savedUser.status,
      };

      const auditLog = this.auditRepo.create({
        adminId,
        targetUserId,
        action: actions.join('; '),
        reason: dto.reason,
        changeSnapshot: JSON.stringify({ before: beforeState, after: afterState }),
      });
      await this.auditRepo.save(auditLog);

      // ── Step 5: Invalidate Redis cache IMMEDIATELY ──────────────
      /**
       * Critical: if this user has an active voice session, the VoiceGateway
       * will re-fetch their profile from SQL on the next cache miss.
       * Without this invalidation, a tier downgrade wouldn't take effect
       * until the cache TTL expires (up to 1 hour).
       */
      await this.redis.invalidateUserCache(targetUserId);

      this.logger.log(
        `God Mode: admin ${adminId} → user ${targetUserId}: ${actions.join(', ')} (reason: ${dto.reason})`,
      );

      return savedUser;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `God Mode grant failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Retrieve audit logs for a target user.
   * Used by admin dashboard for compliance review.
   */
  async getAuditLogs(targetUserId: string): Promise<AdminAuditLog[]> {
    try {
      return await this.auditRepo.find({
        where: { targetUserId },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    } catch (error) {
      this.logger.error(`Failed to fetch audit logs: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get dashboard analytics overview.
   *
   * Aggregates real database metrics for the Admin Dashboard:
   * - Total registered users
   * - Users active in the last 24h (via Sessions)
   * - Revenue MRR estimate (PRO=9.99/mo, UNLIMITED=19.99/mo)
   * - Month-over-Month growth percentage
   */
  async getAnalyticsOverview(): Promise<{
    totalUsers: number;
    activeUsers24h: number;
    revenueMRR: number;
    growthPercentage: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Total users
    const totalUsers = await this.userRepo.count({ where: { isDeleted: false } });

    // Active users in last 24h (had a voice session)
    const activeSessions = await this.sessionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.userId)', 'count')
      .where('s.startTime > :yesterday', { yesterday })
      .getRawOne<{ count: string }>();
    const activeUsers24h = parseInt(activeSessions?.count ?? '0', 10);

    // Revenue MRR: count PRO and UNLIMITED users
    const proCount = await this.userRepo.count({ where: { tier: 'PRO', isDeleted: false } });
    const unlimitedCount = await this.userRepo.count({ where: { tier: 'UNLIMITED', isDeleted: false } });
    const revenueMRR = Math.round(proCount * 9.99 + unlimitedCount * 19.99);

    // Growth: compare new users this month vs last month
    const thisMonthUsers = await this.userRepo.count({
      where: { createdAt: MoreThan(thirtyDaysAgo), isDeleted: false },
    });
    const lastMonthUsers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.createdAt > :start AND u.createdAt <= :end', {
        start: sixtyDaysAgo,
        end: thirtyDaysAgo,
      })
      .andWhere('u.isDeleted = false')
      .getCount();

    const growthPercentage =
      lastMonthUsers > 0
        ? Math.round(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100)
        : 0;

    return { totalUsers, activeUsers24h, revenueMRR, growthPercentage };
  }

  /**
   * Get weekly time-series data for the Admin Dashboard chart.
   *
   * Returns the last 8 weeks of:
   * - newUsers: new user registrations per week
   * - sessions: total voice sessions started per week
   *
   * Design: We compute ISO week boundaries manually to avoid DB-specific
   * date_trunc differences between MSSQL and PostgreSQL.
   */
  async getWeeklyStats(): Promise<
    Array<{
      week: string;      // ISO label e.g. "2025-W12"
      newUsers: number;
      sessions: number;
    }>
  > {
    const now = new Date();
    const results: Array<{ week: string; newUsers: number; sessions: number }> = [];

    for (let i = 7; i >= 0; i--) {
      // Week start = Monday, week end = Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7); // Monday
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Sunday
      weekEnd.setHours(23, 59, 59, 999);

      // ISO week label  e.g. "2025-W12"
      const year = weekStart.getFullYear();
      const jan1 = new Date(year, 0, 1);
      const weekNum = Math.ceil(
        ((weekStart.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
      );
      const weekLabel = `${year}-W${String(weekNum).padStart(2, '0')}`;

      const [newUsers, sessions] = await Promise.all([
        this.userRepo
          .createQueryBuilder('u')
          .where('u.createdAt >= :start AND u.createdAt <= :end', {
            start: weekStart,
            end: weekEnd,
          })
          .andWhere('u.isDeleted = false')
          .getCount(),

        this.sessionRepo
          .createQueryBuilder('s')
          .where('s.startTime >= :start AND s.startTime <= :end', {
            start: weekStart,
            end: weekEnd,
          })
          .getCount(),
      ]);

      results.push({ week: weekLabel, newUsers, sessions });
    }

    return results;
  }
}
