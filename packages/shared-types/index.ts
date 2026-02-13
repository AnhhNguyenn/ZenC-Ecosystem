/**
 * ZenC AI – Shared Type Definitions (v3.0)
 *
 * Single source of truth for enums, constants, and interfaces used across
 * the Gateway Server, AI Worker, and Mobile App.
 *
 * v3.0 – Dual AI Engine (Gemini + OpenAI Realtime), Conversation Modes,
 *         Expanded Exercise Types, Pronunciation Drills.
 *
 * CRITICAL: Any change here requires updates in all consuming services.
 * Use semantic versioning in the package.json to track breaking changes.
 */

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO',
  UNLIMITED = 'UNLIMITED',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
  BANNED = 'BANNED',
}

export enum LanguageLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum LessonType {
  GRAMMAR = 'GRAMMAR',
  VOCABULARY = 'VOCABULARY',
  SPEAKING = 'SPEAKING',
  LISTENING = 'LISTENING',
  CONVERSATION = 'CONVERSATION',
  READING = 'READING',
}

export enum ExerciseType {
  MCQ = 'MCQ',
  FILL_BLANK = 'FILL_BLANK',
  SPEAKING = 'SPEAKING',
  LISTENING = 'LISTENING',
  REORDER = 'REORDER',
  MATCHING = 'MATCHING',
  // v3.0 – Conversational exercise types
  SHADOWING = 'SHADOWING',
  DICTATION = 'DICTATION',
  ROLE_PLAY_SCORED = 'ROLE_PLAY_SCORED',
  PICTURE_DESCRIPTION = 'PICTURE_DESCRIPTION',
  CONVERSATION_COMPLETION = 'CONVERSATION_COMPLETION',
  ERROR_CORRECTION = 'ERROR_CORRECTION',
  TRANSLATION = 'TRANSLATION',
  DEBATE_PROMPT = 'DEBATE_PROMPT',
}

/** Conversation practice modes */
export enum ConversationMode {
  FREE_TALK = 'FREE_TALK',
  ROLE_PLAY = 'ROLE_PLAY',
  SHADOWING = 'SHADOWING',
  DEBATE = 'DEBATE',
  INTERVIEW = 'INTERVIEW',
  TOPIC_DISCUSSION = 'TOPIC_DISCUSSION',
}

/** AI voice provider selection */
export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
}

/** Pronunciation drill types */
export enum PronunciationDrillType {
  MINIMAL_PAIRS = 'MINIMAL_PAIRS',
  IPA_PHONEME = 'IPA_PHONEME',
  TONGUE_TWISTER = 'TONGUE_TWISTER',
  INTONATION = 'INTONATION',
  STRESS_PATTERN = 'STRESS_PATTERN',
  VIETNAMESE_SPECIFIC = 'VIETNAMESE_SPECIFIC',
}

export enum MasteryLevel {
  NEW = 'NEW',
  LEARNING = 'LEARNING',
  REVIEWING = 'REVIEWING',
  MASTERED = 'MASTERED',
}

export enum AchievementRarity {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export enum NotificationType {
  STREAK_WARNING = 'STREAK_WARNING',
  DAILY_REMINDER = 'DAILY_REMINDER',
  ACHIEVEMENT_UNLOCK = 'ACHIEVEMENT_UNLOCK',
  LESSON_AVAILABLE = 'LESSON_AVAILABLE',
  REVIEW_DUE = 'REVIEW_DUE',
  LEVEL_UP = 'LEVEL_UP',
  SYSTEM = 'SYSTEM',
}

export enum AdminAction {
  GRANT_TOKENS = 'GRANT_TOKENS',
  CHANGE_TIER = 'CHANGE_TIER',
  BAN_USER = 'BAN_USER',
  UNLOCK_USER = 'UNLOCK_USER',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

/** Daily XP goal presets (like Duolingo's intensity levels) */
export enum DailyGoalPreset {
  CASUAL = 10,
  REGULAR = 20,
  SERIOUS = 50,
  INSANE = 100,
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const SocketEvents = {
  AUDIO_CHUNK: 'audio_chunk',
  AI_AUDIO_CHUNK: 'ai_audio_chunk',
  GREETING_AUDIO: 'greeting_audio',
  FORCE_DISCONNECT: 'force_disconnect',
  SESSION_STARTED: 'session_started',
  END_SESSION: 'end_session',
  SESSION_ENDED: 'session_ended',
  TOKEN_UPDATE: 'token_update',
  ERROR: 'error',
  AI_TRANSCRIPT: 'ai_transcript',
  CLIENT_CONNECTED: 'client_connected',
  NOTIFICATION: 'notification',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  STREAK_UPDATE: 'streak_update',
  XP_EARNED: 'xp_earned',
  LEVEL_UP: 'level_up',
  // v3.0 – Conversation & Dual AI events
  /** Client requests conversation mode switch */
  SWITCH_MODE: 'switch_mode',
  /** Client sets scenario for role-play/interview */
  SET_SCENARIO: 'set_scenario',
  /** Client requests real-time pronunciation/grammar correction */
  REQUEST_CORRECTION: 'request_correction',
  /** Server notifies provider switch (Gemini→OpenAI) */
  PROVIDER_SWITCHED: 'provider_switched',
  /** Real-time grammar correction from AI */
  GRAMMAR_CORRECTION: 'grammar_correction',
  /** Real-time pronunciation feedback during conversation */
  PRONUNCIATION_FEEDBACK: 'pronunciation_feedback',
  /** Conversation score delivered at end of session */
  CONVERSATION_SCORE: 'conversation_score',
  /** Shadowing: AI speaks reference audio for user to repeat */
  SHADOWING_REFERENCE: 'shadowing_reference',
  /** Shadowing: user's attempt scored */
  SHADOWING_RESULT: 'shadowing_result',
} as const;

export const PubSubChannels = {
  SESSION_ENDED: 'session_ended',
  GRAMMAR_RESULT: 'grammar_result',
  PRONUNCIATION_ASSESS: 'pronunciation_assess',
  PROGRESS_UPDATE: 'progress_update',
  GENERATE_ANALYTICS: 'generate_analytics',
  // v3.0 – Real-time channels
  /** Ultra-fast grammar check during conversation (< 200ms) */
  GRAMMAR_REALTIME: 'grammar_realtime',
  /** Real-time pronunciation feedback during conversation */
  PRONUNCIATION_REALTIME: 'pronunciation_realtime',
  /** Conversation evaluation request (post-session) */
  CONVERSATION_EVALUATE: 'conversation_evaluate',
} as const;

export const RedisKeys = {
  ACTIVE_SESSION: 'active_session',
  USER_PROFILE: 'user_profile',
  DAILY_REVIEW: 'daily_review',
  TOKEN_USAGE: 'token_usage',
  LEADERBOARD_WEEKLY: 'leaderboard:weekly',
  LEADERBOARD_ALLTIME: 'leaderboard:alltime',
  USER_STREAK: 'user_streak',
  DAILY_GOAL: 'daily_goal',
  COURSE_CATALOG: 'course_catalog',
  LESSON_COMPLETION: 'lesson_completion',
  // v3.0 – Conversation & Provider tracking
  /** Current AI provider per user (gemini|openai) */
  AI_PROVIDER: 'ai_provider',
  /** Active conversation mode per session */
  CONVERSATION_MODE: 'conversation_mode',
  /** Conversation history cache (last 5 sessions) */
  CONVERSATION_HISTORY: 'conversation_history',
  /** Real-time grammar corrections queue */
  GRAMMAR_CORRECTIONS: 'grammar_corrections',
  /** User's pronunciation problem sounds profile */
  PRONUNCIATION_PROBLEMS: 'pronunciation_problems',
  /** Conversation confidence score timeline */
  CONFIDENCE_TIMELINE: 'confidence_timeline',
  /** Total speaking minutes counter */
  SPEAKING_MINUTES: 'speaking_minutes',
} as const;

export const AudioConfig = {
  SAMPLE_RATE: 16000,
  BIT_DEPTH: 16,
  CHANNELS: 1,
  JITTER_BUFFER_SIZE: 3,
} as const;

export const RateLimits: Record<
  UserTier,
  {
    requestsPerMin: number;
    voiceMinutesPerDay: number;
    exercisesPerDay: number;
    vocabReviewsPerDay: number;
  }
> = {
  [UserTier.FREE]: {
    requestsPerMin: 20,
    voiceMinutesPerDay: 15,
    exercisesPerDay: 30,
    vocabReviewsPerDay: 20,
  },
  [UserTier.PRO]: {
    requestsPerMin: 60,
    voiceMinutesPerDay: 120,
    exercisesPerDay: Infinity,
    vocabReviewsPerDay: Infinity,
  },
  [UserTier.UNLIMITED]: {
    requestsPerMin: 120,
    voiceMinutesPerDay: Infinity,
    exercisesPerDay: Infinity,
    vocabReviewsPerDay: Infinity,
  },
};

export const ConfidenceThresholds = {
  LOW: 0.4,
  HIGH: 0.8,
} as const;

/** XP required to reach each level (cumulative) */
export const XpLevelThresholds: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  10: 2500,
  15: 5000,
  20: 10000,
  25: 17500,
  30: 27500,
  40: 55000,
  50: 100000,
};

/**
 * Calculate user level from total XP.
 * Uses milestone thresholds; between milestones interpolates linearly.
 */
export function calculateLevel(totalXp: number): number {
  const milestones = Object.entries(XpLevelThresholds)
    .map(([lvl, xp]) => ({ level: Number(lvl), xp }))
    .sort((a, b) => b.xp - a.xp);

  for (const milestone of milestones) {
    if (totalXp >= milestone.xp) {
      // Interpolate between this milestone and the next
      const nextMilestone = milestones.find(
        (m) => m.level > milestone.level,
      );
      if (!nextMilestone) return milestone.level;

      const xpInRange = totalXp - milestone.xp;
      const rangeSize = nextMilestone.xp - milestone.xp;
      const levelsInRange = nextMilestone.level - milestone.level;
      const additionalLevels = Math.floor(
        (xpInRange / rangeSize) * levelsInRange,
      );
      return milestone.level + additionalLevels;
    }
  }
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface JwtPayload {
  sub: string;
  email: string;
  tier: UserTier;
  iat?: number;
  exp?: number;
}

export interface SessionEndedPayload {
  sessionId: string;
  userId: string;
  transcript: string;
  totalTokensConsumed: number;
  startTime: string;
  endTime: string;
}

export interface GrammarMistake {
  originalSentence: string;
  correctedSentence: string;
  grammarRuleId: string;
  explanation: string;
}

/** Pronunciation assessment result from Worker */
export interface PronunciationResult {
  overallScore: number;
  phonemeScores: Array<{
    phoneme: string;
    score: number;
    feedback: string;
  }>;
  problemAreas: string[];
}

/** Weekly learning analytics report */
export interface WeeklyReport {
  userId: string;
  weekStart: string;
  weekEnd: string;
  totalXp: number;
  lessonsCompleted: number;
  exerciseAccuracy: number;
  voiceMinutes: number;
  vocabLearned: number;
  streakDays: number;
  skillRadar: {
    grammar: number;
    vocabulary: number;
    speaking: number;
    listening: number;
    reading: number;
  };
  comparedToLastWeek: {
    xpChange: number;
    accuracyChange: number;
    timeChange: number;
  };
}

/** Content recommendation from Worker */
export interface ContentRecommendation {
  type: 'LESSON' | 'VOCABULARY' | 'EXERCISE' | 'CONVERSATION';
  id: string;
  title: string;
  reason: string;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════
// v3.0 – CONVERSATION & DUAL AI INTERFACES
// ═══════════════════════════════════════════════════════════════

/** Conversation session configuration */
export interface ConversationConfig {
  mode: ConversationMode;
  scenarioId?: string;
  topicId?: string;
  targetLevel: LanguageLevel;
  enableGrammarCorrection: boolean;
  enablePronunciationFeedback: boolean;
  maxDurationMinutes: number;
}

/** Post-conversation evaluation from Worker */
export interface ConversationScore {
  sessionId: string;
  fluency: number;       // 0-100
  accuracy: number;      // 0-100
  complexity: number;    // 0-100
  coherence: number;     // 0-100
  overallScore: number;  // 0-100
  highlights: string[];
  improvements: string[];
  vietnameseAdvice: string;
}

/** Real-time grammar correction event */
export interface GrammarCorrection {
  original: string;
  corrected: string;
  rule: string;
  explanation: string;
  explanationVi: string;
}

/** Shadowing exercise result */
export interface ShadowingResult {
  referenceText: string;
  userText: string;
  accuracy: number;
  pronunciationScore: number;
  missedWords: string[];
  feedback: string;
}

/** Provider health status */
export interface AIProviderStatus {
  provider: AIProvider;
  isHealthy: boolean;
  latencyMs: number;
  lastError?: string;
}
