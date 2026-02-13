import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * SocialService – Daily Challenges and Weekly Missions.
 *
 * Features:
 * - Daily Challenge: One challenge per day for all users (same challenge)
 * - Weekly Missions: 3-5 missions per week with XP rewards
 * - Challenge leaderboard: Track who completed fastest/best
 * - Mission streaks: Bonus XP for consecutive weeks completing all missions
 *
 * Data Storage:
 * - Challenges rotate from a predefined pool
 * - Progress tracked in Redis (ephemeral) + DB (persistent)
 * - Leaderboard in Redis sorted sets
 */
@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Get today's daily challenge.
   * All users get the same challenge each day.
   */
  async getDailyChallenge(userId: string) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length;
    const challenge = DAILY_CHALLENGES[dayIndex];

    // Check if user already completed
    const completedKey = `daily_challenge:${today}:${userId}`;
    const completed = await this.redis.get(completedKey);

    // Get participant count
    const participantsKey = `daily_challenge:${today}:participants`;
    const participantCount = await this.redis.get(participantsKey);

    return {
      ...challenge,
      date: today,
      completed: !!completed,
      completedAt: completed || null,
      participants: Number(participantCount) || 0,
    };
  }

  /**
   * Submit daily challenge completion.
   */
  async completeDailyChallenge(userId: string, result: { score: number }) {
    const today = new Date().toISOString().slice(0, 10);
    const completedKey = `daily_challenge:${today}:${userId}`;
    const already = await this.redis.get(completedKey);

    if (already) {
      return { success: false, message: 'Already completed today' };
    }

    // Mark completed
    await this.redis.set(completedKey, new Date().toISOString(), 86400 * 2);

    // Increment participants
    const participantsKey = `daily_challenge:${today}:participants`;
    const count = await this.redis.get(participantsKey);
    await this.redis.set(participantsKey, String((Number(count) || 0) + 1), 86400 * 2);

    // Add to leaderboard
    const leaderboardKey = `daily_challenge:${today}:leaderboard`;
    await this.redis.zadd(leaderboardKey, result.score, userId);

    // Calculate XP reward
    const xpReward = Math.round(result.score * 0.5) + 50;

    return {
      success: true,
      xpReward,
      score: result.score,
      message: `Challenge completed! +${xpReward} XP 🎉`,
    };
  }

  /**
   * Get daily challenge leaderboard.
   */
  async getDailyChallengeLeaderboard(limit = 20) {
    const today = new Date().toISOString().slice(0, 10);
    const leaderboardKey = `daily_challenge:${today}:leaderboard`;
    return this.redis.getLeaderboard(leaderboardKey, limit);
  }

  /**
   * Get current week's missions.
   */
  async getWeeklyMissions(userId: string) {
    const weekNumber = this.getWeekNumber();
    const missionIndex = weekNumber % WEEKLY_MISSION_SETS.length;
    const missions = WEEKLY_MISSION_SETS[missionIndex];

    // Check completion status per mission
    const statusPromises = missions.map(async (mission: any) => {
      const key = `weekly_mission:${weekNumber}:${userId}:${mission.id}`;
      const progress = await this.redis.get(key);
      return {
        ...mission,
        progress: Number(progress) || 0,
        completed: (Number(progress) || 0) >= mission.target,
      };
    });

    const missionsWithStatus = await Promise.all(statusPromises);
    const allCompleted = missionsWithStatus.every((m: any) => m.completed);

    return {
      weekNumber,
      missions: missionsWithStatus,
      allCompleted,
      bonusXP: allCompleted ? 500 : 0,
    };
  }

  /**
   * Update mission progress.
   */
  async updateMissionProgress(
    userId: string,
    missionId: string,
    incrementBy = 1,
  ) {
    const weekNumber = this.getWeekNumber();
    const key = `weekly_mission:${weekNumber}:${userId}:${missionId}`;
    const current = Number(await this.redis.get(key)) || 0;
    const newValue = current + incrementBy;
    await this.redis.set(key, String(newValue), 86400 * 8); // 8 days TTL

    return { missionId, progress: newValue };
  }

  private getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }
}

// ═══════════════════════════════════════════════════════════════
// STATIC CHALLENGE & MISSION DATA
// ═══════════════════════════════════════════════════════════════

const DAILY_CHALLENGES = [
  { id: 'dc_01', type: 'CONVERSATION', title: '5-Minute Free Talk', description: 'Complete a 5-minute free conversation with the AI tutor', xp: 100, targetMinutes: 5 },
  { id: 'dc_02', type: 'PRONUNCIATION', title: 'Minimal Pair Master', description: 'Complete 10 minimal pair drills with 80%+ accuracy', xp: 80, targetDrills: 10 },
  { id: 'dc_03', type: 'VOCABULARY', title: 'Word Collector', description: 'Learn 5 new vocabulary words in context', xp: 60, targetWords: 5 },
  { id: 'dc_04', type: 'GRAMMAR', title: 'Error Detective', description: 'Find and correct 10 grammar errors', xp: 90, targetErrors: 10 },
  { id: 'dc_05', type: 'LISTENING', title: 'Listen & Type Sprint', description: 'Complete 5 listen-and-type exercises', xp: 70, targetExercises: 5 },
  { id: 'dc_06', type: 'CONVERSATION', title: 'Role-Play Star', description: 'Complete a role-play scenario (restaurant ordering)', xp: 120, scenario: 'RESTAURANT' },
  { id: 'dc_07', type: 'PRONUNCIATION', title: 'Tongue Twister Champion', description: 'Record 3 tongue twisters with 70%+ score', xp: 100, targetTwisters: 3 },
  { id: 'dc_08', type: 'SHADOWING', title: 'Shadow Practice', description: 'Complete 5 shadowing exercises', xp: 80, targetExercises: 5 },
  { id: 'dc_09', type: 'VOCABULARY', title: 'Review Marathon', description: 'Review 20 vocabulary items', xp: 70, targetReviews: 20 },
  { id: 'dc_10', type: 'CONVERSATION', title: 'Debate Round', description: 'Complete a 3-minute debate session', xp: 150, targetMinutes: 3 },
  { id: 'dc_11', type: 'DICTATION', title: 'Dictation Master', description: 'Complete 3 dictation exercises with 85%+ accuracy', xp: 90, targetExercises: 3 },
  { id: 'dc_12', type: 'MIXED', title: 'All-Rounder', description: 'Complete 1 exercise from each category', xp: 200, targetCategories: 4 },
  { id: 'dc_13', type: 'PRONUNCIATION', title: 'Vietnamese Sound Fix', description: 'Practice 5 Vietnamese-specific pronunciation drills', xp: 100, targetDrills: 5 },
  { id: 'dc_14', type: 'CONVERSATION', title: 'Interview Prep', description: 'Complete a mock job interview conversation', xp: 130, scenario: 'INTERVIEW' },
];

const WEEKLY_MISSION_SETS = [
  [
    { id: 'wm_1a', title: 'Conversation Warrior', description: 'Complete 5 conversation sessions this week', target: 5, xp: 300, icon: '💬' },
    { id: 'wm_1b', title: 'Vocab Builder', description: 'Learn 20 new words this week', target: 20, xp: 200, icon: '📚' },
    { id: 'wm_1c', title: 'Pronunciation Pro', description: 'Complete 15 pronunciation drills', target: 15, xp: 250, icon: '🎤' },
    { id: 'wm_1d', title: 'Daily Streak', description: 'Log in 5 out of 7 days', target: 5, xp: 150, icon: '🔥' },
  ],
  [
    { id: 'wm_2a', title: 'Grammar Guardian', description: 'Fix 30 grammar errors this week', target: 30, xp: 300, icon: '✏️' },
    { id: 'wm_2b', title: 'Listening Champion', description: 'Complete 10 listening exercises', target: 10, xp: 250, icon: '👂' },
    { id: 'wm_2c', title: 'Social Butterfly', description: 'Complete 3 daily challenges', target: 3, xp: 200, icon: '🦋' },
    { id: 'wm_2d', title: 'Review Master', description: 'Review 30 vocabulary items', target: 30, xp: 200, icon: '🔄' },
  ],
  [
    { id: 'wm_3a', title: 'Debate Champion', description: 'Complete 3 debate sessions', target: 3, xp: 400, icon: '🏆' },
    { id: 'wm_3b', title: 'Shadow Expert', description: 'Complete 10 shadowing exercises', target: 10, xp: 300, icon: '👥' },
    { id: 'wm_3c', title: 'Word Family Explorer', description: 'Explore 10 word families', target: 10, xp: 200, icon: '🌳' },
    { id: 'wm_3d', title: 'Perfect Score', description: 'Get 100% on any 3 exercises', target: 3, xp: 350, icon: '⭐' },
  ],
];
