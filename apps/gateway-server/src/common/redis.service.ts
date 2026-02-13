import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService – Centralized Redis client for caching, Pub/Sub, and
 * active session management.
 *
 * Design decisions:
 * - Single ioredis instance for commands; a separate `subscriber` instance
 *   for Pub/Sub (ioredis requires dedicated connections for subscriptions).
 * - Using ioredis over node-redis for better TypeScript support, built-in
 *   clustering, and pipeline/transaction APIs.
 * - Connection retry strategy with exponential backoff prevents thundering
 *   herd on Redis restart.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;
  public readonly subscriber: Redis;
  public readonly publisher: Redis;

  constructor(private readonly config: ConfigService) {
    const redisConfig = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      retryStrategy: (times: number): number => {
        /** Exponential backoff capped at 10 seconds */
        const delay = Math.min(times * 200, 10000);
        this.logger.warn(`Redis reconnect attempt #${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.client.on('connect', () => this.logger.log('Redis client connected'));
    this.client.on('error', (err) => this.logger.error('Redis client error', err));
  }

  /**
   * Cache a user profile in Redis with automatic TTL for freshness.
   * Using Redis pipeline to reduce round-trip time when setting
   * multiple hash fields simultaneously.
   */
  async cacheUserProfile(userId: string, profile: Record<string, string>): Promise<void> {
    try {
      const key = `user_profile:${userId}`;
      const pipeline = this.client.pipeline();
      pipeline.hmset(key, profile);
      pipeline.expire(key, 3600); // 1-hour TTL
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to cache profile for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a cached user profile. Returns null on cache miss,
   * allowing the caller to fall back to SQL.
   */
  async getCachedUserProfile(userId: string): Promise<Record<string, string> | null> {
    try {
      const key = `user_profile:${userId}`;
      const profile = await this.client.hgetall(key);
      return Object.keys(profile).length > 0 ? profile : null;
    } catch (error) {
      this.logger.error(`Failed to get cached profile for user ${userId}`, error);
      return null;
    }
  }

  /**
   * Invalidate a user's cached profile. Called by God Mode admin
   * actions to ensure immediate consistency after tier/token changes.
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await this.client.del(`user_profile:${userId}`);
      this.logger.log(`Cache invalidated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Set the active session for multi-login prevention.
   * Key: active_session:{userId} → Value: socketId
   * TTL: 24 hours (auto-cleanup for stale sessions).
   */
  async setActiveSession(userId: string, socketId: string): Promise<void> {
    try {
      await this.client.set(`active_session:${userId}`, socketId, 'EX', 86400);
    } catch (error) {
      this.logger.error(`Failed to set active session for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get the current active socket ID for a user.
   * Returns null if no active session exists.
   */
  async getActiveSession(userId: string): Promise<string | null> {
    try {
      return await this.client.get(`active_session:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to get active session for user ${userId}`, error);
      return null;
    }
  }

  /** Remove active session on disconnect */
  async removeActiveSession(userId: string): Promise<void> {
    try {
      await this.client.del(`active_session:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove active session for user ${userId}`, error);
    }
  }

  /**
   * Track token usage per minute for the Token Watchdog.
   * Uses INCRBY + TTL pattern: key `token_usage:{userId}:{minuteBucket}`
   * auto-expires after 120 seconds, avoiding manual cleanup.
   */
  async incrementTokenUsage(userId: string, tokens: number): Promise<number> {
    try {
      const minuteBucket = Math.floor(Date.now() / 60000);
      const key = `token_usage:${userId}:${minuteBucket}`;
      const pipeline = this.client.pipeline();
      pipeline.incrby(key, tokens);
      pipeline.expire(key, 120); // 2-minute TTL covers current + previous bucket
      const results = await pipeline.exec();
      return (results?.[0]?.[1] as number) || 0;
    } catch (error) {
      this.logger.error(`Failed to increment token usage for user ${userId}`, error);
      return 0;
    }
  }

  /**
   * Publish a message to a Redis Pub/Sub channel.
   * Used to notify the Deep Brain (Python Worker) of session events.
   */
  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.publisher.publish(channel, message);
      this.logger.debug(`Published to channel ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}`, error);
      throw error;
    }
  }

  /**
   * Get the daily review list for proactive greeting.
   * Returns mistake summaries pushed by the Worker's daily cron.
   */
  async getDailyReview(userId: string): Promise<string[]> {
    try {
      return await this.client.lrange(`daily_review:${userId}`, 0, -1);
    } catch (error) {
      this.logger.error(`Failed to get daily review for user ${userId}`, error);
      return [];
    }
  }

  /** Expose raw Redis client for direct access in specialized services */
  getClient(): Redis {
    return this.client;
  }

  // ═══════════════════════════════════════════════════════════
  // GENERIC KEY-VALUE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /** Get a string value by key */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis GET failed for key ${key}`, error);
      return null;
    }
  }

  /**
   * Set a string value with optional TTL (in seconds).
   * Pass ttl=0 for no expiry.
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl && ttl > 0) {
        await this.client.set(key, value, 'EX', ttl);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Redis SET failed for key ${key}`, error);
    }
  }

  /** Delete one or more keys */
  async del(...keys: string[]): Promise<number> {
    try {
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Redis DEL failed for keys ${keys.join(',')}`, error);
      return 0;
    }
  }

  /** Check if a key exists */
  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS failed for key ${key}`, error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SORTED SET OPERATIONS (Leaderboards, rankings)
  // ═══════════════════════════════════════════════════════════

  /** Add or update a member's score in a sorted set */
  async zadd(key: string, score: number, member: string): Promise<void> {
    try {
      await this.client.zadd(key, score, member);
    } catch (error) {
      this.logger.error(`Redis ZADD failed for key ${key}`, error);
    }
  }

  /**
   * Get top N members from a sorted set (highest scores first).
   * Returns array of { member, score } objects.
   */
  async getLeaderboard(key: string, limit = 20): Promise<{ member: string; score: number }[]> {
    try {
      const raw = await this.client.zrevrange(key, 0, limit - 1, 'WITHSCORES');
      const result: { member: string; score: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        result.push({ member: raw[i], score: parseFloat(raw[i + 1]) });
      }
      return result;
    } catch (error) {
      this.logger.error(`Redis ZREVRANGE failed for key ${key}`, error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HASH OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /** Set a single hash field */
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value);
    } catch (error) {
      this.logger.error(`Redis HSET failed for key ${key}`, error);
    }
  }

  /** Get a single hash field */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error(`Redis HGET failed for key ${key}`, error);
      return null;
    }
  }

  /** Get all fields in a hash */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      this.logger.error(`Redis HGETALL failed for key ${key}`, error);
      return {};
    }
  }

  /** Increment a hash field by amount */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    try {
      return await this.client.hincrby(key, field, increment);
    } catch (error) {
      this.logger.error(`Redis HINCRBY failed for key ${key}`, error);
      return 0;
    }
  }

  /** Set TTL on a key */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Redis EXPIRE failed for key ${key}`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LEADERBOARD (Redis Sorted Sets)
  // ═══════════════════════════════════════════════════════════

  /**
   * Add XP to both weekly and all-time leaderboards atomically.
   * Uses ZINCRBY which is O(log N) and creates the member if not exists.
   */
  async addLeaderboardXp(userId: string, xp: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      pipeline.zincrby('leaderboard:weekly', xp, userId);
      pipeline.zincrby('leaderboard:alltime', xp, userId);
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to update leaderboard for ${userId}`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LESSON COMPLETION TRACKING (Redis Bitmaps)
  // ═══════════════════════════════════════════════════════════

  /**
   * Mark a lesson as completed using a Redis SET.
   * This is more flexible than bitmaps for UUID-based lesson IDs.
   */
  async markLessonCompleted(userId: string, lessonId: string): Promise<void> {
    try {
      await this.client.sadd(`lesson_completion:${userId}`, lessonId);
    } catch (error) {
      this.logger.error(`Failed to mark lesson completion for ${userId}`, error);
    }
  }

  /** Check if a specific lesson has been completed */
  async isLessonCompleted(userId: string, lessonId: string): Promise<boolean> {
    try {
      return (await this.client.sismember(`lesson_completion:${userId}`, lessonId)) === 1;
    } catch (error) {
      this.logger.error(`Failed to check lesson completion for ${userId}`, error);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    this.logger.log('Redis connections closed');
  }
}
