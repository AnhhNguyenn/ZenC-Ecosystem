import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RedisService } from '../common/redis.service';
import { ConfigService } from '@nestjs/config';

/**
 * TokenWatchdogInterceptor – Guards against token abuse on HTTP endpoints.
 *
 * Monitors per-user request byte/token usage per minute and blocks users
 * who exceed the threshold (default: 500 tokens/min per spec §5.4).
 *
 * Architecture:
 * - Pre-request: check current minute bucket in Redis
 * - Post-request: increment usage by estimated response tokens
 * - Both checks use Redis INCRBY with auto-expiring minute-bucket keys,
 *   so there's no manual cleanup needed.
 *
 * Note: For WebSocket audio streams, the VoiceGateway has its own inline
 * token tracking. This interceptor covers REST API endpoints (admin, auth, etc).
 */
@Injectable()
export class TokenWatchdogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TokenWatchdogInterceptor.name);
  private readonly threshold: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.threshold = this.config.get<number>('TOKEN_WATCHDOG_THRESHOLD', 500);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub: string } | undefined;

    // Skip unauthenticated requests (they'll be caught by auth guards)
    if (!user?.sub) {
      return next.handle();
    }

    const userId = user.sub;

    try {
      // ── Pre-request check ───────────────────────────────────────
      /**
       * Estimate incoming request tokens from Content-Length header.
       * Rough heuristic: 1 token ≈ 4 bytes (GPT-style tokenization).
       * This is deliberately conservative to avoid false positives.
       */
      const contentLength = parseInt(request.headers['content-length'] || '0', 10);
      const estimatedRequestTokens = Math.ceil(contentLength / 4);

      if (estimatedRequestTokens > 0) {
        const currentUsage = await this.redis.incrementTokenUsage(userId, estimatedRequestTokens);

        if (currentUsage > this.threshold) {
          this.logger.warn(
            `Token Watchdog PRE-CHECK: User ${userId} exceeded threshold: ${currentUsage}/${this.threshold} tokens/min`,
          );
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              error: 'RATE_LIMITED',
              message: 'Token usage rate exceeded. Please wait before making more requests.',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Don't block requests on Redis failures – log and proceed
      this.logger.error(`Token Watchdog pre-check error: ${(error as Error).message}`);
    }

    // ── Post-request tracking ───────────────────────────────────
    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          /**
           * Estimate response tokens from the serialized response size.
           * This captures the actual AI-generated content cost.
           */
          const responseSize = JSON.stringify(responseData).length;
          const estimatedResponseTokens = Math.ceil(responseSize / 4);

          if (estimatedResponseTokens > 0) {
            await this.redis.incrementTokenUsage(userId, estimatedResponseTokens);
          }
        } catch (error) {
          this.logger.error(`Token Watchdog post-check error: ${(error as Error).message}`);
        }
      }),
      catchError((err) => {
        return throwError(() => err);
      }),
    );
  }
}
