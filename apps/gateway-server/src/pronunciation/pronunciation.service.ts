import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

/**
 * PronunciationService – Gateway-side orchestrator for pronunciation assessment.
 *
 * Delegates actual scoring to the Python AI Worker via Redis Pub/Sub.
 * The flow is:
 * 1. Client uploads audio + reference text via REST
 * 2. Gateway publishes to Redis channel `pronunciation_assess`
 * 3. Worker picks up, runs Gemini-powered phoneme analysis
 * 4. Worker publishes result back or stores in DB
 * 5. Gateway returns result to client (polling or WebSocket push)
 *
 * This keeps the Gateway non-blocking while the Worker handles
 * the computationally expensive audio analysis.
 */
@Injectable()
export class PronunciationService {
  private readonly logger = new Logger(PronunciationService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Request pronunciation assessment.
   * Audio is base64-encoded in the payload (kept in RAM, never on disk).
   */
  async requestAssessment(
    userId: string,
    audioBase64: string,
    referenceText: string,
    exerciseId?: string,
  ): Promise<{ assessmentId: string; status: string }> {
    const assessmentId = `pron_${userId}_${Date.now()}`;

    const payload = JSON.stringify({
      assessmentId,
      userId,
      audioBase64,
      referenceText,
      exerciseId: exerciseId || null,
      timestamp: new Date().toISOString(),
    });

    // Publish to Worker for processing
    await this.redis.publish('pronunciation_assess', payload);

    // Store pending status
    const client = this.redis.getClient();
    await client.set(
      `pronunciation:${assessmentId}`,
      JSON.stringify({ status: 'PROCESSING' }),
      'EX',
      300, // 5-minute TTL
    );

    this.logger.log(`Pronunciation assessment requested: ${assessmentId}`);

    return { assessmentId, status: 'PROCESSING' };
  }

  /**
   * Poll assessment result.
   * Client calls this after submitting audio to check if analysis is done.
   */
  async getResult(assessmentId: string): Promise<{
    status: string;
    result?: {
      overallScore: number;
      phonemeScores: Array<{ phoneme: string; score: number; feedback: string }>;
      problemAreas: string[];
    };
  }> {
    const client = this.redis.getClient();
    const data = await client.get(`pronunciation:${assessmentId}`);

    if (!data) {
      return { status: 'NOT_FOUND' };
    }

    return JSON.parse(data);
  }

  /**
   * Get user's weakest phonemes based on historical assessments.
   */
  async getProblemSounds(userId: string): Promise<{
    problemPhonemes: Array<{ phoneme: string; avgScore: number; count: number }>;
  }> {
    const client = this.redis.getClient();
    const data = await client.get(`pronunciation:problems:${userId}`);

    if (!data) {
      return { problemPhonemes: [] };
    }

    return JSON.parse(data);
  }
}
