import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
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
}
