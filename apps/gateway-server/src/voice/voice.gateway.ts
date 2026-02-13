import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter } from 'events';
import { GeminiService } from './gemini.service';
import { OpenAIRealtimeService } from './openai-realtime.service';
import { RedisService } from '../common/redis.service';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { Session } from '../entities/session.entity';

/**
 * VoiceGateway v3.0 – Dual AI Engine + Conversation Modes
 *
 * Socket.io gateway handling real-time audio streaming between the mobile
 * client and AI providers (Gemini 2.5 Flash primary, OpenAI Realtime fallback).
 *
 * Architecture:
 * - On connection: JWT auth → multi-login check → provider selection → greeting
 * - Audio flow: Client PCM → Jitter Buffer → AI Provider WS → AI audio → Client
 * - Provider failover: Gemini fail → automatic switch to OpenAI Realtime
 * - On disconnect: Session log → Redis Pub/Sub → Deep Brain analysis + scoring
 *
 * Conversation Modes:
 * - FREE_TALK:        Open conversation with AI tutor
 * - ROLE_PLAY:        Interactive scenario (restaurant, interview, etc.)
 * - SHADOWING:        AI speaks → user repeats → scoring
 * - DEBATE:           AI takes opposing view
 * - INTERVIEW:        Mock interview with scoring
 * - TOPIC_DISCUSSION: Guided topic-based conversation
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/voice',
  transports: ['websocket'],
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  // ── Session tracking maps ─────────────────────────────────────
  private readonly jitterBuffers = new Map<string, Buffer[]>();
  private readonly JITTER_BUFFER_SIZE = 3;
  private readonly socketSessions = new Map<string, string>();
  private readonly socketUsers = new Map<string, string>();
  private readonly sessionTranscripts = new Map<string, string>();
  private readonly dbSessionIds = new Map<string, string>();
  private readonly sessionTokenCounts = new Map<string, number>();

  // ── v3.0: Dual provider + conversation mode tracking ──────────
  /** Maps socketId → current AI provider ('gemini' | 'openai') */
  private readonly socketProviders = new Map<string, 'gemini' | 'openai'>();
  /** Maps socketId → current conversation mode */
  private readonly socketModes = new Map<string, string>();
  /** Maps socketId → EventEmitter from active AI provider */
  private readonly socketEmitters = new Map<string, EventEmitter>();
  /** Maps socketId → session start time for duration tracking */
  private readonly sessionStartTimes = new Map<string, number>();
  /** Maps socketId → real-time correction enabled flag */
  private readonly correctionEnabled = new Map<string, boolean>();
  /** Maps socketId → user transcript accumulator (from user speech) */
  private readonly userTranscripts = new Map<string, string>();

  constructor(
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIRealtimeService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Handle new socket connection.
   *
   * Flow:
   * 1. JWT authentication
   * 2. Multi-login prevention
   * 3. Load user profile (Redis → SQL fallback)
   * 4. Select AI provider (Gemini primary → OpenAI fallback)
   * 5. Create AI session with adaptive system prompt
   * 6. Proactive greeting
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // ── Step 1: JWT Authentication ──────────────────────────────
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected: no token (${client.id})`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      let payload: { sub: string; email: string; tier: string };
      try {
        payload = this.jwtService.verify(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
      } catch {
        this.logger.warn(`Connection rejected: invalid token (${client.id})`);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      this.socketUsers.set(client.id, userId);

      // ── Step 2: Multi-Login Prevention ──────────────────────────
      const existingSocketId = await this.redis.getActiveSession(userId);
      if (existingSocketId && existingSocketId !== client.id) {
        this.logger.warn(
          `Multi-login detected for user ${userId}: kicking ${existingSocketId}`,
        );
        this.server.to(existingSocketId).emit('force_disconnect', {
          reason: 'New login detected from another device',
        });
        const oldSocket = this.server.sockets.sockets.get(existingSocketId);
        if (oldSocket) oldSocket.disconnect(true);
      }
      await this.redis.setActiveSession(userId, client.id);

      // ── Step 3: Load User Profile ───────────────────────────────
      let profile = await this.redis.getCachedUserProfile(userId);
      if (!profile) {
        const dbProfile = await this.profileRepo.findOne({ where: { userId } });
        const dbUser = await this.userRepo.findOne({ where: { id: userId } });

        if (dbProfile && dbUser) {
          profile = {
            currentLevel: dbProfile.currentLevel,
            confidenceScore: String(dbProfile.confidenceScore),
            vnSupportEnabled: String(dbProfile.vnSupportEnabled),
            tier: dbUser.tier,
          };
          await this.redis.cacheUserProfile(userId, profile);
        } else {
          profile = {
            currentLevel: 'A1',
            confidenceScore: '0.5',
            vnSupportEnabled: 'true',
            tier: 'FREE',
          };
        }
      }

      // ── Step 4: Select AI Provider ──────────────────────────────
      const provider = this.selectProvider();
      this.socketProviders.set(client.id, provider);

      // ── Step 5: Create AI Session ───────────────────────────────
      const systemPrompt = this.buildAdaptivePrompt(profile, 'FREE_TALK');
      const sessionId = `${userId}_${Date.now()}`;
      this.socketSessions.set(client.id, sessionId);
      this.sessionTranscripts.set(client.id, '');
      this.userTranscripts.set(client.id, '');
      this.sessionTokenCounts.set(client.id, 0);
      this.socketModes.set(client.id, 'FREE_TALK');
      this.sessionStartTimes.set(client.id, Date.now());
      this.correctionEnabled.set(client.id, true);

      // Create DB session
      const dbSession = this.sessionRepo.create({
        userId,
        startTime: new Date(),
        clientIp: client.handshake.address,
        deviceFingerprint: client.handshake.headers['user-agent'] || null,
      });
      const savedSession = await this.sessionRepo.save(dbSession);
      this.dbSessionIds.set(client.id, savedSession.id);

      // Initialize jitter buffer
      this.jitterBuffers.set(client.id, []);

      // Create AI session with selected provider
      const emitter = this.createAISession(provider, sessionId, systemPrompt);
      this.socketEmitters.set(client.id, emitter);
      this.bindEmitterEvents(client, emitter, provider);

      client.emit('session_started', {
        sessionId,
        provider,
        mode: 'FREE_TALK',
      });

      // ── Step 6: Proactive Greeting ──────────────────────────────
      const featureGreeting = this.config.get<string>(
        'FEATURE_PROACTIVE_GREETING',
        'true',
      );
      if (featureGreeting === 'true') {
        await this.sendProactiveGreeting(
          client,
          userId,
          profile,
          sessionId,
          provider,
        );
      }

      this.logger.log(
        `Client connected: ${client.id} (user: ${userId}, provider: ${provider})`,
      );
    } catch (error) {
      this.logger.error(
        `Connection handler error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.cleanupSession(client, 'disconnect');
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Disconnect handler error: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AI PROVIDER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Select the best available AI provider.
   * Primary: Gemini 2.5 Flash | Fallback: OpenAI Realtime
   */
  private selectProvider(): 'gemini' | 'openai' {
    const primaryConfig = this.config.get<string>(
      'AI_PROVIDER_PRIMARY',
      'gemini',
    );

    if (primaryConfig === 'gemini' && this.geminiService.isHealthy()) {
      return 'gemini';
    }
    if (primaryConfig === 'openai' && this.openaiService.isHealthy()) {
      return 'openai';
    }

    // Fallback logic
    if (this.geminiService.isHealthy()) return 'gemini';
    if (this.openaiService.isHealthy()) return 'openai';

    // Both unhealthy – try Gemini anyway (it will retry)
    this.logger.warn('Both AI providers unhealthy, defaulting to Gemini');
    return 'gemini';
  }

  /**
   * Create an AI session using the specified provider.
   * Both providers return an EventEmitter with identical interfaces.
   */
  private createAISession(
    provider: 'gemini' | 'openai',
    sessionId: string,
    systemPrompt: string,
  ): EventEmitter {
    if (provider === 'openai') {
      return this.openaiService.createSession(sessionId, systemPrompt);
    }
    return this.geminiService.createSession(sessionId, systemPrompt);
  }

  /**
   * Bind EventEmitter events from the AI provider to the Socket.io client.
   *
   * Both Gemini and OpenAI emit the same events:
   * - audioResponse → stream to client
   * - textResponse → transcript + real-time grammar check
   * - fallbackToText → trigger provider switch or text mode
   * - error → log and notify client
   */
  private bindEmitterEvents(
    client: Socket,
    emitter: EventEmitter,
    provider: 'gemini' | 'openai',
  ): void {
    emitter.on('audioResponse', (audioBuffer: Buffer) => {
      client.emit('ai_audio_chunk', audioBuffer);
    });

    emitter.on('textResponse', (text: string) => {
      client.emit('ai_transcript', { text });

      // Accumulate AI transcript
      const current = this.sessionTranscripts.get(client.id) || '';
      this.sessionTranscripts.set(client.id, `${current}\nAI: ${text}`);

      // Trigger real-time grammar check on user's recent text if enabled
      if (this.correctionEnabled.get(client.id)) {
        this.triggerRealtimeGrammarCheck(client);
      }
    });

    emitter.on('userTranscript', (text: string) => {
      // Accumulate user's own transcript (from OpenAI Whisper or Gemini)
      const current = this.userTranscripts.get(client.id) || '';
      this.userTranscripts.set(client.id, `${current}\nUser: ${text}`);

      const fullTranscript = this.sessionTranscripts.get(client.id) || '';
      this.sessionTranscripts.set(
        client.id,
        `${fullTranscript}\nUser: ${text}`,
      );
    });

    emitter.on('turnComplete', () => {
      client.emit('turn_complete');
    });

    emitter.on('fallbackToText', () => {
      // Try switching to the other provider before falling back to text
      this.attemptProviderSwitch(client);
    });

    emitter.on('error', (error: Error) => {
      this.logger.error(
        `${provider} error for ${client.id}: ${error.message}`,
      );
      client.emit('error', {
        message: 'AI service temporary error',
        code: 'AI_ERROR',
      });
    });
  }

  /**
   * Attempt to switch from the current provider to the fallback.
   * If current = Gemini → switch to OpenAI, and vice versa.
   * If both fail → emit text-only fallback.
   */
  private async attemptProviderSwitch(client: Socket): Promise<void> {
    const currentProvider = this.socketProviders.get(client.id);
    const sessionId = this.socketSessions.get(client.id);
    const userId = this.socketUsers.get(client.id);

    if (!sessionId || !userId) return;

    const newProvider =
      currentProvider === 'gemini' ? 'openai' : 'gemini';

    const isNewProviderHealthy =
      newProvider === 'gemini'
        ? this.geminiService.isHealthy()
        : this.openaiService.isHealthy();

    if (!isNewProviderHealthy) {
      this.logger.error(
        `Both providers exhausted for ${client.id}, falling back to text`,
      );
      client.emit('error', {
        message: 'Voice mode unavailable. Switching to text mode.',
        code: 'VOICE_FALLBACK',
      });
      return;
    }

    this.logger.warn(
      `Switching provider for ${client.id}: ${currentProvider} → ${newProvider}`,
    );

    // Close old provider session
    if (currentProvider === 'gemini') {
      this.geminiService.closeSession(sessionId);
    } else {
      this.openaiService.closeSession(sessionId);
    }

    // Remove old emitter listeners
    const oldEmitter = this.socketEmitters.get(client.id);
    if (oldEmitter) oldEmitter.removeAllListeners();

    // Load profile for rebuilding system prompt
    const profile = await this.redis.getCachedUserProfile(userId);
    const mode = this.socketModes.get(client.id) || 'FREE_TALK';
    const systemPrompt = this.buildAdaptivePrompt(
      profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
      mode,
    );

    // Create new session with fallback provider
    const newSessionId = `${sessionId}_retry_${newProvider}`;
    const newEmitter = this.createAISession(
      newProvider,
      newSessionId,
      systemPrompt,
    );

    this.socketProviders.set(client.id, newProvider);
    this.socketSessions.set(client.id, newSessionId);
    this.socketEmitters.set(client.id, newEmitter);
    this.bindEmitterEvents(client, newEmitter, newProvider);

    client.emit('provider_switched', {
      from: currentProvider,
      to: newProvider,
      message: `Switched to ${newProvider === 'gemini' ? 'Gemini 2.5 Flash' : 'OpenAI Realtime'} for better stability.`,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIO HANDLING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Handle incoming audio chunks from the client.
   * Jitter buffer (size 3) → concatenate → forward to active AI provider.
   */
  @SubscribeMessage('audio_chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Buffer,
  ): void {
    try {
      const sessionId = this.socketSessions.get(client.id);
      if (!sessionId) {
        client.emit('error', { message: 'No active session' });
        return;
      }

      const buffer = this.jitterBuffers.get(client.id);
      if (!buffer) return;

      buffer.push(Buffer.from(data));

      if (buffer.length >= this.JITTER_BUFFER_SIZE) {
        const concatenated = Buffer.concat(buffer);
        this.jitterBuffers.set(client.id, []);

        // Forward to active provider
        const provider = this.socketProviders.get(client.id);
        if (provider === 'openai') {
          this.openaiService.sendAudioChunk(sessionId, concatenated);
        } else {
          this.geminiService.sendAudioChunk(sessionId, concatenated);
        }

        // Audio token estimation: 16kHz * 16-bit * mono = 32000 bytes/sec
        // Gemini charges ~25 tokens/second of audio
        const audioDurationSec = concatenated.length / 32000;
        const estimatedTokens = Math.ceil(audioDurationSec * 25);
        this.trackTokenUsage(client, estimatedTokens);
      }
    } catch (error) {
      this.logger.error(
        `Audio chunk handling error: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONVERSATION MODE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Switch conversation mode mid-session.
   *
   * Supported modes:
   * - FREE_TALK: Open conversation
   * - ROLE_PLAY: Interactive scenario (requires scenarioId)
   * - SHADOWING: AI speaks reference → user repeats
   * - DEBATE: AI takes opposing view
   * - INTERVIEW: Mock interview with scoring
   * - TOPIC_DISCUSSION: Guided discussion on a topic
   */
  @SubscribeMessage('switch_mode')
  async handleSwitchMode(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      mode: string;
      scenarioId?: string;
      topicId?: string;
    },
  ): Promise<void> {
    try {
      const validModes = [
        'FREE_TALK',
        'ROLE_PLAY',
        'SHADOWING',
        'DEBATE',
        'INTERVIEW',
        'TOPIC_DISCUSSION',
      ];
      if (!validModes.includes(data.mode)) {
        client.emit('error', {
          message: `Invalid mode. Valid: ${validModes.join(', ')}`,
        });
        return;
      }

      const sessionId = this.socketSessions.get(client.id);
      const userId = this.socketUsers.get(client.id);
      if (!sessionId || !userId) return;

      this.socketModes.set(client.id, data.mode);

      // Rebuild system prompt for new mode
      const profile = await this.redis.getCachedUserProfile(userId);
      const systemPrompt = this.buildAdaptivePrompt(
        profile || { currentLevel: 'A1', confidenceScore: '0.5', vnSupportEnabled: 'true', tier: 'FREE' },
        data.mode,
        data.scenarioId,
        data.topicId,
      );

      // Send mode context to the AI
      const provider = this.socketProviders.get(client.id);
      if (provider === 'openai') {
        this.openaiService.sendTextPrompt(sessionId, systemPrompt);
      } else {
        this.geminiService.sendTextPrompt(sessionId, systemPrompt);
      }

      client.emit('mode_switched', {
        mode: data.mode,
        message: this.getModeWelcomeMessage(data.mode),
      });

      this.logger.log(
        `Mode switched to ${data.mode} for ${client.id} (user: ${userId})`,
      );
    } catch (error) {
      this.logger.error(
        `Switch mode error: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set a specific scenario for role-play or interview mode.
   */
  @SubscribeMessage('set_scenario')
  async handleSetScenario(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      scenarioId: string;
      category: string;
      difficulty?: string;
    },
  ): Promise<void> {
    try {
      const sessionId = this.socketSessions.get(client.id);
      const userId = this.socketUsers.get(client.id);
      if (!sessionId || !userId) return;

      const provider = this.socketProviders.get(client.id);
      const scenarioPrompt = this.buildScenarioPrompt(
        data.category,
        data.scenarioId,
        data.difficulty || 'B1',
      );

      if (provider === 'openai') {
        this.openaiService.sendTextPrompt(sessionId, scenarioPrompt);
      } else {
        this.geminiService.sendTextPrompt(sessionId, scenarioPrompt);
      }

      client.emit('scenario_set', {
        scenarioId: data.scenarioId,
        category: data.category,
      });
    } catch (error) {
      this.logger.error(
        `Set scenario error: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Toggle real-time grammar/pronunciation correction on/off.
   */
  @SubscribeMessage('request_correction')
  handleCorrectionToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { enabled: boolean },
  ): void {
    this.correctionEnabled.set(client.id, data.enabled);
    client.emit('correction_toggled', { enabled: data.enabled });
  }

  /**
   * Handle explicit session end request.
   * Triggers post-session conversation scoring.
   */
  @SubscribeMessage('end_session')
  async handleEndSession(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      // Request conversation scoring before cleanup
      await this.requestConversationScore(client);
      await this.cleanupSession(client, 'client_requested');
      client.emit('session_ended', { message: 'Session ended successfully' });
    } catch (error) {
      this.logger.error(
        `End session error: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // REAL-TIME INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Trigger real-time grammar check via Redis Pub/Sub to Worker.
   * Non-blocking: publishes user's recent text for async correction.
   * Worker responds via Redis key that Gateway polls.
   */
  private async triggerRealtimeGrammarCheck(client: Socket): Promise<void> {
    try {
      const enabled = this.config.get<string>(
        'REALTIME_GRAMMAR_ENABLED',
        'true',
      );
      if (enabled !== 'true') return;

      const userId = this.socketUsers.get(client.id);
      const userText = this.userTranscripts.get(client.id) || '';

      // Only check the last spoken sentence
      const lines = userText.split('\n').filter((l) => l.startsWith('User: '));
      const lastSentence = lines[lines.length - 1]?.replace('User: ', '') || '';

      if (lastSentence.length < 5) return;

      const correctionId = `grammar_rt:${userId}:${Date.now()}`;
      await this.redis.publish(
        'grammar_realtime',
        JSON.stringify({
          correctionId,
          userId,
          text: lastSentence,
          socketId: client.id,
        }),
      );

      // Poll for result with exponential backoff (100ms → 200ms → 400ms → 800ms → 1600ms)
      const pollIntervals = [100, 200, 400, 800, 1600];
      let attempt = 0;
      const pollForResult = async (): Promise<void> => {
        if (attempt >= pollIntervals.length) return;
        try {
          const result = await this.redis.get(correctionId);
          if (result) {
            const correction = JSON.parse(result);
            if (correction.hasMistake) {
              client.emit('grammar_correction', correction);
            }
            return;
          }
        } catch {
          return; // Non-critical: silently skip
        }
        const delay = pollIntervals[attempt++];
        setTimeout(pollForResult, delay);
      };
      setTimeout(pollForResult, pollIntervals[attempt++]);
    } catch (error) {
      this.logger.error(
        `Grammar check error: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Request post-session conversation scoring from the AI Worker.
   * Publishes full transcript for comprehensive evaluation.
   */
  private async requestConversationScore(client: Socket): Promise<void> {
    try {
      const userId = this.socketUsers.get(client.id);
      const sessionId = this.socketSessions.get(client.id);
      const transcript = this.sessionTranscripts.get(client.id) || '';
      const mode = this.socketModes.get(client.id) || 'FREE_TALK';
      const startTime = this.sessionStartTimes.get(client.id) || Date.now();
      const durationMinutes = (Date.now() - startTime) / 60000;

      if (!userId || transcript.length < 50) return;

      await this.redis.publish(
        'conversation_evaluate',
        JSON.stringify({
          userId,
          sessionId,
          transcript,
          mode,
          durationMinutes: Math.round(durationMinutes * 10) / 10,
          provider: this.socketProviders.get(client.id),
        }),
      );

      // Update speaking minutes counter
      await this.redis.getClient().incrbyfloat(
        `speaking_minutes:${userId}`,
        durationMinutes,
      );
    } catch (error) {
      this.logger.error(
        `Conversation scoring request error: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TOKEN TRACKING
  // ═══════════════════════════════════════════════════════════════

  private async trackTokenUsage(
    client: Socket,
    tokens: number,
  ): Promise<void> {
    try {
      const userId = this.socketUsers.get(client.id);
      if (!userId) return;

      const currentUsage = await this.redis.incrementTokenUsage(
        userId,
        tokens,
      );
      const threshold = this.config.get<number>(
        'TOKEN_WATCHDOG_THRESHOLD',
        500,
      );

      if (currentUsage > threshold) {
        this.logger.warn(
          `Token watchdog for user ${userId}: ${currentUsage}/${threshold} tokens/min`,
        );
        client.emit('error', {
          message: 'Usage rate exceeded. Please wait a moment.',
          code: 'RATE_LIMITED',
        });
      }

      const sessionCount =
        (this.sessionTokenCounts.get(client.id) || 0) + tokens;
      this.sessionTokenCounts.set(client.id, sessionCount);
      client.emit('token_update', { tokensUsed: sessionCount });
    } catch (error) {
      this.logger.error(
        `Token tracking error: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION CLEANUP
  // ═══════════════════════════════════════════════════════════════

  private async cleanupSession(
    client: Socket,
    reason: string,
  ): Promise<void> {
    const sessionId = this.socketSessions.get(client.id);
    const userId = this.socketUsers.get(client.id);
    const dbSessionId = this.dbSessionIds.get(client.id);
    const transcript = this.sessionTranscripts.get(client.id) || '';
    const tokensUsed = this.sessionTokenCounts.get(client.id) || 0;
    const provider = this.socketProviders.get(client.id);

    // 1. Close AI provider session
    if (sessionId) {
      if (provider === 'openai') {
        this.openaiService.closeSession(sessionId);
      } else {
        this.geminiService.closeSession(sessionId);
      }
    }

    // Remove emitter listeners
    const emitter = this.socketEmitters.get(client.id);
    if (emitter) emitter.removeAllListeners();

    // 2. Update DB session
    if (dbSessionId) {
      try {
        await this.sessionRepo.update(dbSessionId, {
          endTime: new Date(),
          totalTokensConsumed: tokensUsed,
          transcript,
        });
      } catch (error) {
        this.logger.error(
          `Failed to update session record: ${(error as Error).message}`,
        );
      }
    }

    // 3. Publish session_ended for Deep Brain analysis
    if (userId && transcript.length > 0) {
      try {
        await this.redis.publish(
          'session_ended',
          JSON.stringify({
            sessionId: dbSessionId || sessionId || 'unknown',
            userId,
            transcript,
            totalTokensConsumed: tokensUsed,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
          }),
        );
      } catch (error) {
        this.logger.error(
          `Failed to publish session_ended: ${(error as Error).message}`,
        );
      }
    }

    // 4. Deduct tokens
    if (userId && tokensUsed > 0) {
      try {
        await this.userRepo
          .createQueryBuilder()
          .update(User)
          .set({
            tokenBalance: () =>
              `CASE WHEN tokenBalance >= ${tokensUsed} THEN tokenBalance - ${tokensUsed} ELSE 0 END`,
          })
          .where('id = :id', { id: userId })
          .execute();
      } catch (error) {
        this.logger.error(
          `Failed to deduct tokens: ${(error as Error).message}`,
        );
      }
    }

    // 5. Clean up all tracking maps
    this.socketSessions.delete(client.id);
    this.socketUsers.delete(client.id);
    this.jitterBuffers.delete(client.id);
    this.sessionTranscripts.delete(client.id);
    this.userTranscripts.delete(client.id);
    this.dbSessionIds.delete(client.id);
    this.sessionTokenCounts.delete(client.id);
    this.socketProviders.delete(client.id);
    this.socketModes.delete(client.id);
    this.socketEmitters.delete(client.id);
    this.sessionStartTimes.delete(client.id);
    this.correctionEnabled.delete(client.id);

    // 6. Remove active session from Redis
    if (userId) {
      await this.redis.removeActiveSession(userId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROACTIVE GREETING
  // ═══════════════════════════════════════════════════════════════

  private async sendProactiveGreeting(
    client: Socket,
    userId: string,
    profile: Record<string, string>,
    sessionId: string,
    provider: 'gemini' | 'openai',
  ): Promise<void> {
    try {
      const dailyReview = await this.redis.getDailyReview(userId);
      const confidence = parseFloat(profile['confidenceScore'] || '0.5');
      const level = profile['currentLevel'] || 'A1';

      let greetingPrompt: string;

      if (dailyReview.length > 0) {
        const reviewSummary = dailyReview.slice(0, 3).join(', ');
        greetingPrompt = this.buildGreetingWithReview(
          level,
          confidence,
          reviewSummary,
          dailyReview.length,
        );
      } else {
        greetingPrompt = this.buildSimpleGreeting(level, confidence);
      }

      if (provider === 'openai') {
        this.openaiService.sendTextPrompt(sessionId, greetingPrompt);
      } else {
        this.geminiService.sendTextPrompt(sessionId, greetingPrompt);
      }
    } catch (error) {
      this.logger.error(
        `Proactive greeting failed for user ${userId}: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROMPT BUILDERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build adaptive system prompt based on user profile AND conversation mode.
   *
   * The system prompt varies by:
   * 1. Confidence level (Vietnamese scaffolding for low confidence)
   * 2. Conversation mode (different instructions per mode)
   * 3. CEFR level (vocabulary and grammar complexity)
   */
  private buildAdaptivePrompt(
    profile: Record<string, string>,
    mode: string,
    scenarioId?: string,
    topicId?: string,
  ): string {
    const confidence = parseFloat(profile['confidenceScore'] || '0.5');
    const level = profile['currentLevel'] || 'A1';
    const vnSupport = profile['vnSupportEnabled'] === 'true';

    const basePrompt = `You are ZenC AI, a friendly and patient English conversation tutor. The student's current CEFR level is ${level}.`;

    // Language adaptation based on confidence
    let languageInstructions: string;
    if (confidence < 0.4 && vnSupport) {
      languageInstructions = `The student has low confidence (${confidence}). Use Vietnamese explanations when introducing new concepts. Mix Vietnamese and English naturally. Be extra encouraging. Use simple sentences and provide Vietnamese translations for difficult words.`;
    } else if (confidence > 0.8) {
      languageInstructions = `The student has high confidence (${confidence}). Use natural English only. Challenge them with complex structures and advanced vocabulary. Encourage self-correction.`;
    } else {
      languageInstructions = `The student has moderate confidence (${confidence}). Use primarily English with occasional Vietnamese hints when they struggle. Balance challenge and support.`;
    }

    // Mode-specific instructions
    const modeInstructions = this.getModeInstructions(
      mode,
      level,
      scenarioId,
      topicId,
    );

    return `${basePrompt}\n${languageInstructions}\n\n${modeInstructions}`;
  }

  /**
   * Get mode-specific AI behavior instructions.
   */
  private getModeInstructions(
    mode: string,
    level: string,
    scenarioId?: string,
    topicId?: string,
  ): string {
    switch (mode) {
      case 'FREE_TALK':
        return `MODE: Free Conversation
You are having a natural, open-ended conversation. Topics can flow freely.
- Ask open-ended questions to encourage speaking
- Gently correct grammar mistakes by rephrasing
- Introduce new vocabulary naturally in context
- Adapt complexity to ${level} level
- Keep responses conversational and brief (2-3 sentences)`;

      case 'ROLE_PLAY':
        return `MODE: Role-Play Scenario${scenarioId ? ` (Scenario: ${scenarioId})` : ''}
You are acting as a character in a real-life scenario. Stay in character.
- Respond naturally as your character would
- Use vocabulary and phrases common in this scenario
- If the student makes errors, continue naturally but model correct usage
- Guide the conversation forward with prompts
- Keep the scenario realistic and at ${level} level`;

      case 'SHADOWING':
        return `MODE: Shadowing Practice
Speak a clear, natural English sentence. Then WAIT for the student to repeat it.
- Speak slowly and clearly at ${level} level
- After the student repeats, provide pronunciation feedback
- Gradually increase sentence complexity
- Focus on natural rhythm and intonation
- Provide encouragement after each attempt`;

      case 'DEBATE':
        return `MODE: Debate Practice
Take the opposing side of the given topic and debate with the student.
- Present clear arguments at ${level} level
- Challenge the student's points respectfully
- Use debate vocabulary: "However", "On the other hand", "I disagree because..."
- Model good argumentation structure
- Praise strong arguments from the student`;

      case 'INTERVIEW':
        return `MODE: Mock Interview${scenarioId ? ` (Type: ${scenarioId})` : ''}
You are an interviewer conducting a professional interview.
- Ask common interview questions appropriate for the scenario
- Follow up on answers naturally
- Provide feedback on answer quality after each response
- Coach on using STAR method (Situation, Task, Action, Result)
- Use professional vocabulary at ${level} level`;

      case 'TOPIC_DISCUSSION':
        return `MODE: Topic Discussion${topicId ? ` (Topic: ${topicId})` : ''}
Guide a focused discussion on a specific topic.
- Introduce the topic with a question or statement
- Ask probing questions to deepen discussion
- Introduce topic-specific vocabulary
- Encourage the student to express opinions with supporting reasons
- Keep discussion at ${level} level with appropriate complexity`;

      default:
        return `Have a natural English conversation at ${level} level.`;
    }
  }

  private getModeWelcomeMessage(mode: string): string {
    const messages: Record<string, string> = {
      FREE_TALK: "Let's have a free conversation! What's on your mind?",
      ROLE_PLAY: 'Role-play mode activated! Set a scenario to begin.',
      SHADOWING:
        "Shadowing mode! I'll speak a sentence, then you repeat it.",
      DEBATE:
        "Debate mode! Give me a topic and I'll take the opposing view.",
      INTERVIEW:
        'Interview mode! Tell me what kind of interview you want to practice.',
      TOPIC_DISCUSSION:
        "Topic discussion mode! I'll guide us through a topic.",
    };
    return messages[mode] || 'Mode activated!';
  }

  private buildScenarioPrompt(
    category: string,
    scenarioId: string,
    difficulty: string,
  ): string {
    return `[SCENARIO START]
Category: ${category}
Scenario ID: ${scenarioId}
Difficulty: ${difficulty}

You are now acting in this scenario. Set the scene briefly, then start the conversation as your character. Stay in character throughout. The student will play the other role. Guide naturally but let them speak. If they seem stuck, provide gentle hints.
[BEGIN]`;
  }

  private buildGreetingWithReview(
    level: string,
    confidence: number,
    reviewSummary: string,
    totalReviews: number,
  ): string {
    if (confidence < 0.4) {
      return `Chào mừng bạn trở lại! Hôm nay bạn có ${totalReviews} bài tập cần ôn lại: ${reviewSummary}. Bạn sẵn sàng chưa? (Greet the student warmly in Vietnamese, mention they have ${totalReviews} review items about: ${reviewSummary}. Keep it encouraging and brief.)`;
    }
    return `Welcome back! You have ${totalReviews} exercises to review today, including: ${reviewSummary}. Shall we start with those, or practice something new? (Keep the greeting warm, brief, at ${level} level.)`;
  }

  private buildSimpleGreeting(level: string, confidence: number): string {
    if (confidence < 0.4) {
      return `Chào bạn! Chúng ta sẽ luyện tập tiếng Anh cùng nhau hôm nay. (Greet the student warmly in Vietnamese, ask what they'd like to practice, keep it at ${level} level.)`;
    }
    return `Hello! I'm your English tutor. What would you like to practice today? (Keep the greeting natural, warm, calibrated to ${level} level.)`;
  }
}
