import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * ConversationMilestoneService – Gamification for conversation practice.
 *
 * Milestone Categories:
 * 1. Conversation Count Milestones (first 1, 10, 50, 100, 500 conversations)
 * 2. Duration Milestones (cumulative speaking time)
 * 3. Mode Milestones (try all conversation modes)
 * 4. Score Milestones (achieve high scores)
 * 5. Streak Milestones (consecutive days practicing)
 * 6. Skill Badges (pronunciation, grammar, vocabulary mastery)
 *
 * All milestones award XP and can trigger achievement unlocks.
 */
@Injectable()
export class ConversationMilestoneService {
  private readonly logger = new Logger(ConversationMilestoneService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if any milestones were unlocked after a conversation session.
   * Called by ConversationService after session ends.
   */
  async checkAndUnlockMilestones(
    userId: string,
    sessionData: {
      mode: string;
      durationMinutes: number;
      overallScore: number;
      provider: string;
    },
  ): Promise<UnlockedMilestone[]> {
    const unlocked: UnlockedMilestone[] = [];

    // Update cumulative stats
    const stats = await this.updateUserStats(userId, sessionData);

    // Check each milestone category
    for (const milestone of MILESTONES) {
      const alreadyUnlocked = await this.redis.get(
        `milestone:${userId}:${milestone.id}`,
      );
      if (alreadyUnlocked) continue;

      const achieved = this.checkMilestone(milestone, stats);
      if (achieved) {
        await this.redis.set(
          `milestone:${userId}:${milestone.id}`,
          new Date().toISOString(),
          0, // No expiry
        );
        unlocked.push({
          id: milestone.id,
          title: milestone.title,
          titleVi: milestone.titleVi,
          description: milestone.description,
          xpReward: milestone.xpReward,
          icon: milestone.icon,
          tier: milestone.tier,
        });
        this.logger.log(`Milestone unlocked: ${milestone.id} for user ${userId}`);
      }
    }

    return unlocked;
  }

  /**
   * Get all milestone progress for a user.
   */
  async getMilestoneProgress(userId: string) {
    const stats = await this.getUserStats(userId);
    const milestoneProgress = [];

    for (const milestone of MILESTONES) {
      const unlockedAt = await this.redis.get(
        `milestone:${userId}:${milestone.id}`,
      );

      milestoneProgress.push({
        id: milestone.id,
        title: milestone.title,
        titleVi: milestone.titleVi,
        description: milestone.description,
        icon: milestone.icon,
        tier: milestone.tier,
        xpReward: milestone.xpReward,
        unlocked: !!unlockedAt,
        unlockedAt,
        progress: this.getProgress(milestone, stats),
      });
    }

    return {
      milestones: milestoneProgress,
      stats,
      totalUnlocked: milestoneProgress.filter((m: any) => m.unlocked).length,
      totalMilestones: MILESTONES.length,
    };
  }

  /**
   * Get user's overall confidence score based on conversation data.
   */
  async getConfidenceScore(userId: string): Promise<{
    overall: number;
    pronunciation: number;
    grammar: number;
    vocabulary: number;
    fluency: number;
  }> {
    const stats = await this.getUserStats(userId);
    return {
      overall: Math.min(100, Math.round((stats.totalConversations * 2) + (stats.averageScore * 0.5))),
      pronunciation: Math.min(100, Math.round(stats.pronunciationScore || 50)),
      grammar: Math.min(100, Math.round(stats.grammarScore || 50)),
      vocabulary: Math.min(100, Math.round(stats.vocabularyScore || 50)),
      fluency: Math.min(100, Math.round(stats.averageScore || 50)),
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private async updateUserStats(userId: string, session: any): Promise<UserConvStats> {
    const key = `conv_stats:${userId}`;
    const existing = await this.redis.get(key);
    const stats: UserConvStats = existing
      ? JSON.parse(existing)
      : { totalConversations: 0, totalMinutes: 0, modesUsed: [], averageScore: 0, highestScore: 0, pronunciationScore: 50, grammarScore: 50, vocabularyScore: 50, consecutiveDays: 0, lastSessionDate: '' };

    stats.totalConversations++;
    stats.totalMinutes += session.durationMinutes;
    if (!stats.modesUsed.includes(session.mode)) {
      stats.modesUsed.push(session.mode);
    }
    stats.averageScore =
      (stats.averageScore * (stats.totalConversations - 1) + session.overallScore) /
      stats.totalConversations;
    stats.highestScore = Math.max(stats.highestScore, session.overallScore);

    // Track consecutive days
    const today = new Date().toISOString().slice(0, 10);
    if (stats.lastSessionDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      stats.consecutiveDays = stats.lastSessionDate === yesterday
        ? stats.consecutiveDays + 1
        : 1;
      stats.lastSessionDate = today;
    }

    await this.redis.set(key, JSON.stringify(stats), 0);
    return stats;
  }

  private async getUserStats(userId: string): Promise<UserConvStats> {
    const key = `conv_stats:${userId}`;
    const data = await this.redis.get(key);
    return data
      ? JSON.parse(data)
      : { totalConversations: 0, totalMinutes: 0, modesUsed: [], averageScore: 0, highestScore: 0, pronunciationScore: 50, grammarScore: 50, vocabularyScore: 50, consecutiveDays: 0, lastSessionDate: '' };
  }

  private checkMilestone(milestone: Milestone, stats: UserConvStats): boolean {
    switch (milestone.condition.type) {
      case 'conversations':
        return stats.totalConversations >= milestone.condition.value;
      case 'minutes':
        return stats.totalMinutes >= milestone.condition.value;
      case 'modes':
        return stats.modesUsed.length >= milestone.condition.value;
      case 'score':
        return stats.highestScore >= milestone.condition.value;
      case 'consecutiveDays':
        return stats.consecutiveDays >= milestone.condition.value;
      default:
        return false;
    }
  }

  private getProgress(milestone: Milestone, stats: UserConvStats): { current: number; target: number; percent: number } {
    let current = 0;
    switch (milestone.condition.type) {
      case 'conversations': current = stats.totalConversations; break;
      case 'minutes': current = stats.totalMinutes; break;
      case 'modes': current = stats.modesUsed.length; break;
      case 'score': current = stats.highestScore; break;
      case 'consecutiveDays': current = stats.consecutiveDays; break;
    }
    return {
      current,
      target: milestone.condition.value,
      percent: Math.min(100, Math.round((current / milestone.condition.value) * 100)),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// TYPES & STATIC DATA
// ═══════════════════════════════════════════════════════════════

interface UserConvStats {
  totalConversations: number;
  totalMinutes: number;
  modesUsed: string[];
  averageScore: number;
  highestScore: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyScore: number;
  consecutiveDays: number;
  lastSessionDate: string;
}

interface Milestone {
  id: string;
  title: string;
  titleVi: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  xpReward: number;
  condition: { type: string; value: number };
}

interface UnlockedMilestone {
  id: string;
  title: string;
  titleVi: string;
  description: string;
  xpReward: number;
  icon: string;
  tier: string;
}

const MILESTONES: Milestone[] = [
  // Conversation Count Milestones
  { id: 'conv_1', title: 'First Words', titleVi: 'Những từ đầu tiên', description: 'Complete your first conversation', icon: '🗣️', tier: 'bronze', xpReward: 100, condition: { type: 'conversations', value: 1 } },
  { id: 'conv_10', title: 'Getting Chatty', titleVi: 'Bắt đầu trò chuyện', description: 'Complete 10 conversations', icon: '💬', tier: 'bronze', xpReward: 200, condition: { type: 'conversations', value: 10 } },
  { id: 'conv_50', title: 'Conversation Enthusiast', titleVi: 'Người yêu trò chuyện', description: 'Complete 50 conversations', icon: '🎙️', tier: 'silver', xpReward: 500, condition: { type: 'conversations', value: 50 } },
  { id: 'conv_100', title: 'Conversationalist', titleVi: 'Nhà đàm thoại', description: 'Complete 100 conversations', icon: '🏆', tier: 'gold', xpReward: 1000, condition: { type: 'conversations', value: 100 } },
  { id: 'conv_500', title: 'Master Speaker', titleVi: 'Bậc thầy nói', description: 'Complete 500 conversations', icon: '👑', tier: 'diamond', xpReward: 5000, condition: { type: 'conversations', value: 500 } },

  // Duration Milestones (cumulative minutes)
  { id: 'time_60', title: 'First Hour', titleVi: 'Giờ đầu tiên', description: 'Spend 1 hour in conversation', icon: '⏰', tier: 'bronze', xpReward: 150, condition: { type: 'minutes', value: 60 } },
  { id: 'time_600', title: '10 Hour Club', titleVi: 'Câu lạc bộ 10 giờ', description: 'Spend 10 hours in conversation', icon: '⏳', tier: 'silver', xpReward: 500, condition: { type: 'minutes', value: 600 } },
  { id: 'time_3000', title: '50 Hour Hero', titleVi: 'Anh hùng 50 giờ', description: 'Spend 50 hours in conversation', icon: '🕐', tier: 'gold', xpReward: 2000, condition: { type: 'minutes', value: 3000 } },

  // Mode Milestones
  { id: 'mode_3', title: 'Mode Explorer', titleVi: 'Nhà thám hiểm chế độ', description: 'Try 3 different conversation modes', icon: '🧭', tier: 'bronze', xpReward: 200, condition: { type: 'modes', value: 3 } },
  { id: 'mode_6', title: 'Mode Master', titleVi: 'Bậc thầy chế độ', description: 'Try all 6 conversation modes', icon: '🌟', tier: 'gold', xpReward: 1000, condition: { type: 'modes', value: 6 } },

  // Score Milestones
  { id: 'score_70', title: 'Good Speaker', titleVi: 'Người nói tốt', description: 'Score 70+ in a conversation', icon: '📈', tier: 'bronze', xpReward: 150, condition: { type: 'score', value: 70 } },
  { id: 'score_85', title: 'Excellent Speaker', titleVi: 'Người nói xuất sắc', description: 'Score 85+ in a conversation', icon: '🎯', tier: 'silver', xpReward: 300, condition: { type: 'score', value: 85 } },
  { id: 'score_95', title: 'Near Native', titleVi: 'Gần như bản ngữ', description: 'Score 95+ in a conversation', icon: '💎', tier: 'diamond', xpReward: 2000, condition: { type: 'score', value: 95 } },

  // Streak Milestones
  { id: 'streak_3', title: 'Three Day Streak', titleVi: 'Chuỗi 3 ngày', description: 'Practice 3 days in a row', icon: '🔥', tier: 'bronze', xpReward: 100, condition: { type: 'consecutiveDays', value: 3 } },
  { id: 'streak_7', title: 'Week Warrior', titleVi: 'Chiến binh tuần', description: 'Practice 7 days in a row', icon: '🔥', tier: 'silver', xpReward: 300, condition: { type: 'consecutiveDays', value: 7 } },
  { id: 'streak_30', title: 'Monthly Master', titleVi: 'Bậc thầy tháng', description: 'Practice 30 days in a row', icon: '🔥', tier: 'gold', xpReward: 1500, condition: { type: 'consecutiveDays', value: 30 } },
  { id: 'streak_100', title: 'Unstoppable', titleVi: 'Không thể ngăn cản', description: 'Practice 100 days in a row', icon: '🔥', tier: 'diamond', xpReward: 5000, condition: { type: 'consecutiveDays', value: 100 } },
];
