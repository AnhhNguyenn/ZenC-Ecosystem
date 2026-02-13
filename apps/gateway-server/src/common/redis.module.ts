import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * RedisModule – Global module providing the RedisService singleton.
 *
 * Marked @Global so that Auth, Voice, Admin, and Security modules
 * can inject RedisService without importing RedisModule individually.
 * This mirrors the "nervous system" metaphor in the spec – Redis
 * connects all subsystems.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
