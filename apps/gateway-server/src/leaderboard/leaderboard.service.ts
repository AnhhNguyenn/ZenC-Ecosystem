import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * LeaderboardService – Real-time ranking powered by Redis Sorted Sets.
 *
 * Architecture:
 * - Weekly leaderboard: Redis ZSET with auto-expiry on Sunday midnight (UTC)
 * - All-time leaderboard: Persistent Redis ZSET
 * - ZINCRBY for atomic XP increments (O(log N) – handles millions of users)
 * - ZREVRANGE for top-N retrieval (O(log N + M))
 *
 * Why Redis over SQL:
 * - SQL ORDER BY with OFFSET is O(N log N) on full table scans
 * - Redis ZSET operations are O(log N), making rankings instant at any scale
 * - Weekly leaderboard resets automatically via TTL
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly WEEKLY_KEY = 'leaderboard:weekly';
  private readonly ALLTIME_KEY = 'leaderboard:alltime';

  constructor(private readonly redis: RedisService) {}

  /**
   * Get weekly leaderboard (top N users by this week's XP).
   * Includes the requesting user's rank if not in top N.
   */
  async getWeekly(
    userId: string,
    limit: number = 30,
  ): Promise<{
    rankings: Array<{ userId: string; xp: number; rank: number }>;
    userRank: { rank: number; xp: number } | null;
  }> {
    const client = this.redis.getClient();

    // Get top N with scores
    const topUsers = await client.zrevrange(this.WEEKLY_KEY, 0, limit - 1, 'WITHSCORES');
    const rankings = this._parseRankings(topUsers);

    // Get requesting user's rank
    const userRank = await this._getUserRank(userId, this.WEEKLY_KEY);

    return { rankings, userRank };
  }

  /** Get all-time leaderboard */
  async getAllTime(
    userId: string,
    limit: number = 30,
  ): Promise<{
    rankings: Array<{ userId: string; xp: number; rank: number }>;
    userRank: { rank: number; xp: number } | null;
  }> {
    const client = this.redis.getClient();
    const topUsers = await client.zrevrange(this.ALLTIME_KEY, 0, limit - 1, 'WITHSCORES');
    const rankings = this._parseRankings(topUsers);
    const userRank = await this._getUserRank(userId, this.ALLTIME_KEY);

    return { rankings, userRank };
  }

  /** Parse Redis ZREVRANGE WITHSCORES result into structured array */
  private _parseRankings(
    data: string[],
  ): Array<{ userId: string; xp: number; rank: number }> {
    const rankings: Array<{ userId: string; xp: number; rank: number }> = [];
    for (let i = 0; i < data.length; i += 2) {
      rankings.push({
        userId: data[i],
        xp: parseFloat(data[i + 1]),
        rank: Math.floor(i / 2) + 1,
      });
    }
    return rankings;
  }

  /** Get a specific user's rank and XP from a leaderboard key */
  private async _getUserRank(
    userId: string,
    key: string,
  ): Promise<{ rank: number; xp: number } | null> {
    const client = this.redis.getClient();
    const rank = await client.zrevrank(key, userId);
    if (rank === null) return null;

    const score = await client.zscore(key, userId);
    return {
      rank: rank + 1, // Convert 0-indexed to 1-indexed
      xp: parseFloat(score || '0'),
    };
  }
}
