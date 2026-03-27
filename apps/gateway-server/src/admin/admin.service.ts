import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { RedisService } from '../common/redis.service';
import { GrantDto } from './admin.dto';

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
    private readonly config: ConfigService,
  ) {}

  async grantToUser(
    adminId: string,
    targetUserId: string,
    dto: GrantDto,
  ): Promise<User> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException(`User ${targetUserId} not found`);
      }

      const beforeState = {
        tier: user.tier,
        tokenBalance: user.tokenBalance,
        status: user.status,
      };

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
      const afterState = {
        tier: savedUser.tier,
        tokenBalance: savedUser.tokenBalance,
        status: savedUser.status,
      };

      if (dto.tier || dto.status) {
        await this.rotateUserAuthState(savedUser.id, savedUser.status !== 'ACTIVE');
      }

      const auditLog = this.auditRepo.create({
        adminId,
        targetUserId,
        action: actions.join('; '),
        reason: dto.reason,
        changeSnapshot: JSON.stringify({ before: beforeState, after: afterState }),
      });
      await this.auditRepo.save(auditLog);
      await this.redis.invalidateUserCache(targetUserId);

      this.logger.log(
        `God Mode: admin ${adminId} -> user ${targetUserId}: ${actions.join(', ')} (reason: ${dto.reason})`,
      );

      return savedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `God Mode grant failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

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

    const totalUsers = await this.userRepo.count({ where: { isDeleted: false } });

    const activeSessions = await this.sessionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.userId)', 'count')
      .where('s.startTime > :yesterday', { yesterday })
      .getRawOne<{ count: string }>();
    const activeUsers24h = parseInt(activeSessions?.count ?? '0', 10);

    const proCount = await this.userRepo.count({
      where: { tier: 'PRO', isDeleted: false },
    });
    const unlimitedCount = await this.userRepo.count({
      where: { tier: 'UNLIMITED', isDeleted: false },
    });
    const revenueMRR = Math.round(proCount * 9.99 + unlimitedCount * 19.99);

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

  async getWeeklyStats(): Promise<
    Array<{
      week: string;
      newUsers: number;
      sessions: number;
    }>
  > {
    const now = new Date();
    const results: Array<{ week: string; newUsers: number; sessions: number }> = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

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

  async listRagSources(): Promise<{
    sources: Array<{ source: string; chunks: number }>;
    total: number;
  }> {
    const response = await this.fetchWorker('/api/v1/rag/sources', {
      method: 'GET',
    });
    return this.parseWorkerJson<{
      sources: Array<{ source: string; chunks: number }>;
      total: number;
    }>(response, 'list RAG sources');
  }

  async ingestRagDocument(
    file: any,
    sourceName: string,
  ): Promise<{
    message: string;
    chunksIngested: number;
    sourceName: string;
  }> {
    const fileName = file.originalname?.toLowerCase() ?? '';
    const mimeType = file.mimetype?.toLowerCase() ?? '';

    if (!fileName.endsWith('.pdf') && mimeType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([file.buffer], { type: file.mimetype || 'application/pdf' }),
      file.originalname || 'document.pdf',
    );
    formData.append('source_name', sourceName);

    const response = await this.fetchWorker('/api/v1/rag/ingest', {
      method: 'POST',
      body: formData,
    });

    const payload = await this.parseWorkerJson<{
      message: string;
      chunks_ingested: number;
      source_name: string;
    }>(response, 'ingest RAG document');

    return {
      message: payload.message,
      chunksIngested: payload.chunks_ingested,
      sourceName: payload.source_name,
    };
  }

  private async fetchWorker(path: string, init: RequestInit): Promise<Response> {
    const workerBaseUrl = this.getRequiredConfig(
      'AI_WORKER_BASE_URL',
      'http://ai-worker:8000',
    ).replace(/\/+$/, '');
    const adminSecret = this.getRequiredConfig('ADMIN_SECRET_KEY');
    const timeoutMs = Number(
      this.config.get<string>('AI_WORKER_TIMEOUT_MS', '10000'),
    );

    try {
      return await fetch(`${workerBaseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${adminSecret}`,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        `Worker request failed for ${path}: ${(error as Error).message}`,
      );
      throw new BadGatewayException('AI Worker is unavailable');
    }
  }

  private async parseWorkerJson<T>(
    response: Response,
    operation: string,
  ): Promise<T> {
    const rawBody = await response.text();
    let payload: any = {};

    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { detail: rawBody };
      }
    }

    if (!response.ok) {
      this.logger.error(
        `Failed to ${operation}: status=${response.status} body=${rawBody}`,
      );
      throw new BadGatewayException(
        typeof payload?.detail === 'string'
          ? payload.detail
          : `Failed to ${operation}`,
      );
    }

    return payload as T;
  }

  private getRequiredConfig(key: string, fallback?: string): string {
    const value = this.config.get<string>(key, fallback ?? '');
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }

  private async rotateUserAuthState(
    userId: string,
    clearRefreshToken: boolean,
  ): Promise<void> {
    await this.redis.getClient().incr(`auth_version:${userId}`);
    await this.redis.removeActiveSession(userId);

    if (clearRefreshToken) {
      await this.userRepo.update(userId, { refreshTokenHash: null });
    }
  }
}
