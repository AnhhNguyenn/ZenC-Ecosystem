import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { RedisService } from '../common/redis.service';

/**
 * ConversationService – Manages conversation session records
 * and provides analytics for the conversation practice feature.
 *
 * Responsibilities:
 * - Create and finalize conversation session records
 * - Store and retrieve conversation scores from Worker
 * - Track conversation history and trends
 * - Provide conversation statistics for progress dashboard
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly redis: RedisService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new conversation record when a voice session starts.
   */
  async createConversation(data: {
    userId: string;
    mode: string;
    provider: string;
    scenarioId?: string;
    topicId?: string;
  }): Promise<Conversation> {
    const conversation = this.conversationRepo.create({
      userId: data.userId,
      mode: data.mode,
      provider: data.provider,
      scenarioId: data.scenarioId || null,
      topicId: data.topicId || null,
    });

    const saved = await this.conversationRepo.save(conversation);
    this.logger.log(
      `Conversation created: ${saved.id} (mode: ${data.mode}, provider: ${data.provider})`,
    );
    return saved;
  }

  /**
   * Finalize a conversation with transcript and duration.
   * Called when the voice session ends.
   */
  async finalizeConversation(
    conversationId: string,
    data: {
      transcript: string;
      userTranscript: string;
      durationMinutes: number;
      totalTokens: number;
    },
  ): Promise<void> {
    const wordCount = data.transcript
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    await this.conversationRepo.update(conversationId, {
      transcript: data.transcript,
      userTranscript: data.userTranscript,
      durationMinutes: Math.round(data.durationMinutes * 10) / 10,
      totalTokens: data.totalTokens,
      wordCount,
    });
  }

  /**
   * Store conversation evaluation scores from the AI Worker.
   * Called via polling endpoint when Worker completes scoring.
   */
  async storeScores(
    conversationId: string,
    scores: {
      fluency: number;
      accuracy: number;
      complexity: number;
      coherence: number;
      overall: number;
      highlights: string[];
      improvements: string[];
      vietnameseAdvice: string;
    },
  ): Promise<void> {
    await this.conversationRepo.update(conversationId, {
      fluencyScore: scores.fluency,
      accuracyScore: scores.accuracy,
      complexityScore: scores.complexity,
      coherenceScore: scores.coherence,
      overallScore: scores.overall,
      highlights: JSON.stringify(scores.highlights),
      improvements: JSON.stringify(scores.improvements),
      vietnameseAdvice: scores.vietnameseAdvice,
    });

    this.logger.log(
      `Scores stored for conversation ${conversationId}: overall=${scores.overall}`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY & ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get user's conversation history with pagination.
   */
  async getHistory(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    conversations: Partial<Conversation>[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [conversations, total] = await this.conversationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: [
        'id',
        'mode',
        'provider',
        'scenarioId',
        'durationMinutes',
        'overallScore',
        'fluencyScore',
        'accuracyScore',
        'wordCount',
        'createdAt',
      ],
    });

    return {
      conversations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get full conversation details including transcript and scores.
   */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepo.findOne({
      where: { id: conversationId, userId },
    });
  }

  /**
   * Get conversation transcript with AI annotations.
   */
  async getTranscript(
    conversationId: string,
    userId: string,
  ): Promise<{
    transcript: string;
    userTranscript: string;
    annotations: unknown;
  } | null> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, userId },
      select: ['transcript', 'userTranscript', 'highlights', 'improvements'],
    });

    if (!conv) return null;

    return {
      transcript: conv.transcript || '',
      userTranscript: conv.userTranscript || '',
      annotations: {
        highlights: conv.highlights ? JSON.parse(conv.highlights) : [],
        improvements: conv.improvements ? JSON.parse(conv.improvements) : [],
      },
    };
  }

  /**
   * Get conversation score for a specific session.
   */
  async getScore(
    conversationId: string,
    userId: string,
  ): Promise<{
    fluency: number;
    accuracy: number;
    complexity: number;
    coherence: number;
    overall: number;
    highlights: string[];
    improvements: string[];
    vietnameseAdvice: string;
  } | null> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, userId },
    });

    if (!conv || conv.overallScore === null) return null;

    return {
      fluency: conv.fluencyScore || 0,
      accuracy: conv.accuracyScore || 0,
      complexity: conv.complexityScore || 0,
      coherence: conv.coherenceScore || 0,
      overall: conv.overallScore || 0,
      highlights: conv.highlights ? JSON.parse(conv.highlights) : [],
      improvements: conv.improvements ? JSON.parse(conv.improvements) : [],
      vietnameseAdvice: conv.vietnameseAdvice || '',
    };
  }

  /**
   * Get conversation statistics for progress dashboard.
   * Uses SQL aggregation to avoid loading all records into memory.
   */
  async getStats(userId: string): Promise<{
    totalConversations: number;
    totalMinutes: number;
    totalWords: number;
    averageScore: number;
    scoreByMode: Record<string, number>;
    recentTrend: Array<{ date: string; score: number; minutes: number }>;
    confidenceScore: number;
  }> {
    // ── Aggregated stats via SQL ─────────────────────────────
    const aggregated = await this.conversationRepo
      .createQueryBuilder('c')
      .select('COUNT(c.id)', 'totalConversations')
      .addSelect('COALESCE(SUM(c.durationMinutes), 0)', 'totalMinutes')
      .addSelect('COALESCE(SUM(c.wordCount), 0)', 'totalWords')
      .addSelect('COALESCE(AVG(c.overallScore), 0)', 'averageScore')
      .where('c.userId = :userId', { userId })
      .getRawOne();

    const totalConversations = Number(aggregated?.totalConversations) || 0;
    const totalMinutes = Math.round(Number(aggregated?.totalMinutes) || 0);
    const totalWords = Number(aggregated?.totalWords) || 0;
    const averageScore =
      Math.round((Number(aggregated?.averageScore) || 0) * 10) / 10;

    // ── Score by mode via SQL GROUP BY ─────────────────────────
    const modeScores = await this.conversationRepo
      .createQueryBuilder('c')
      .select('c.mode', 'mode')
      .addSelect('AVG(c.overallScore)', 'avgScore')
      .where('c.userId = :userId', { userId })
      .andWhere('c.overallScore IS NOT NULL')
      .groupBy('c.mode')
      .getRawMany();

    const scoreByMode: Record<string, number> = {};
    for (const row of modeScores) {
      scoreByMode[row.mode] = Math.round((Number(row.avgScore) || 0) * 10) / 10;
    }

    // ── Recent 14-day trend (limited query) ────────────────────
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentConvs = await this.conversationRepo.find({
      where: { userId, createdAt: MoreThan(twoWeeksAgo) },
      order: { createdAt: 'DESC' },
      select: ['createdAt', 'overallScore', 'durationMinutes'],
      take: 100, // Safety cap
    });

    const recentTrend = recentConvs.map((c) => ({
      date: c.createdAt.toISOString().split('T')[0],
      score: c.overallScore || 0,
      minutes: c.durationMinutes,
    }));

    // ── Confidence score (last 10 scored sessions) ──────────────
    const last10 = await this.conversationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['overallScore'],
      take: 10,
    });

    const scored10 = last10.filter((c) => c.overallScore !== null);
    const confidenceScore =
      scored10.length > 0
        ? Math.round(
            (scored10.reduce((s, c) => s + (c.overallScore || 0), 0) /
              scored10.length /
              100) *
              100,
          ) / 100
        : 0.5;

    return {
      totalConversations,
      totalMinutes,
      totalWords,
      averageScore,
      scoreByMode,
      recentTrend,
      confidenceScore,
    };
  }

  /**
   * Submit user feedback for a conversation (quality rating).
   */
  async submitFeedback(
    conversationId: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<void> {
    // Store feedback in Redis for batch processing
    await this.redis.getClient().lpush(
      'conversation_feedback',
      JSON.stringify({
        conversationId,
        userId,
        rating: Math.min(5, Math.max(1, rating)),
        comment: comment?.substring(0, 500) || '',
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
