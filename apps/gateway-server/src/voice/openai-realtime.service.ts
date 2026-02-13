import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * OpenAIRealtimeService – WebSocket client for OpenAI Realtime API.
 *
 * Acts as the FALLBACK provider when Gemini is unavailable or fails.
 * Implements the same EventEmitter interface as GeminiService so the
 * VoiceGateway can switch providers transparently.
 *
 * OpenAI Realtime API specifics:
 * - WebSocket endpoint: wss://api.openai.com/v1/realtime
 * - Audio format: PCM 16-bit, 24kHz, mono (auto-resampled from 16kHz input)
 * - Auth via headers (not query params like Gemini)
 * - Session-based: one WS connection per conversation
 *
 * Events emitted (same as GeminiService):
 * - 'audioResponse' (Buffer) – streamed audio from OpenAI
 * - 'textResponse' (string) – transcript of AI response
 * - 'error' (Error) – connection/processing error
 * - 'turnComplete' – AI finished speaking
 * - 'close' – session terminated
 */
@Injectable()
export class OpenAIRealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(OpenAIRealtimeService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly wsUrl: string;
  private readonly activeSessions = new Map<string, OpenAISession>();

  /** Track health for provider selection */
  private lastError: string | null = null;
  private lastLatencyMs = 0;
  private consecutiveFailures = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
    this.model = this.config.get<string>(
      'OPENAI_REALTIME_MODEL',
      'gpt-4o-realtime-preview',
    );
    this.wsUrl = this.config.get<string>(
      'OPENAI_REALTIME_WS_URL',
      'wss://api.openai.com/v1/realtime',
    );
  }

  /**
   * Check if this provider is healthy and available.
   * Used by VoiceGateway for fallback decision.
   */
  isHealthy(): boolean {
    return this.apiKey.length > 0 && this.consecutiveFailures < 5;
  }

  getStatus(): { isHealthy: boolean; latencyMs: number; lastError: string | null } {
    return {
      isHealthy: this.isHealthy(),
      latencyMs: this.lastLatencyMs,
      lastError: this.lastError,
    };
  }

  /**
   * Create a new OpenAI Realtime session for voice conversation.
   * Returns an EventEmitter compatible with GeminiService's interface.
   */
  createSession(sessionId: string, systemPrompt: string): EventEmitter {
    const emitter = new EventEmitter();
    const session: OpenAISession = {
      sessionId,
      emitter,
      ws: null,
      retryCount: 0,
      isAlive: true,
      connectStartTime: Date.now(),
    };

    this.activeSessions.set(sessionId, session);
    this.connectToOpenAI(session, systemPrompt);

    return emitter;
  }

  /**
   * Establish WebSocket connection to OpenAI Realtime API.
   *
   * Key differences from Gemini:
   * - Authentication via Authorization header (not URL param)
   * - Model specified via query param AND headers
   * - Session config sent as 'session.update' event after connection
   * - Audio format is PCM 24kHz (we resample from 16kHz on send)
   */
  private connectToOpenAI(session: OpenAISession, systemPrompt: string): void {
    try {
      session.connectStartTime = Date.now();
      const url = `${this.wsUrl}?model=${this.model}`;

      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      session.ws = ws;

      ws.on('open', () => {
        const latency = Date.now() - session.connectStartTime;
        this.lastLatencyMs = latency;
        this.consecutiveFailures = 0;
        this.lastError = null;

        this.logger.log(
          `OpenAI Realtime WS connected for session ${session.sessionId} (${latency}ms)`,
        );

        // Configure session with system prompt and audio settings
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            temperature: 0.8,
            max_response_output_tokens: 4096,
          },
        };

        ws.send(JSON.stringify(sessionUpdate));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          this.handleOpenAIMessage(session, data);
        } catch (error) {
          this.logger.error(
            `Error processing OpenAI message for session ${session.sessionId}`,
            (error as Error).stack,
          );
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        this.logger.log(
          `OpenAI Realtime WS closed for session ${session.sessionId}: ${code} ${reason.toString()}`,
        );
        this.handleDisconnect(session, systemPrompt);
      });

      ws.on('error', (error: Error) => {
        this.consecutiveFailures++;
        this.lastError = error.message;
        this.logger.error(
          `OpenAI Realtime WS error for session ${session.sessionId}: ${error.message}`,
        );
        session.emitter.emit('error', error);
      });
    } catch (error) {
      this.consecutiveFailures++;
      this.lastError = (error as Error).message;
      this.logger.error(
        `Failed to connect to OpenAI Realtime: ${(error as Error).message}`,
      );
      session.emitter.emit('error', error);
    }
  }

  /**
   * Parse incoming OpenAI Realtime WebSocket messages.
   *
   * OpenAI Realtime events:
   * - 'session.created' / 'session.updated' – session lifecycle
   * - 'response.audio.delta' – streamed audio chunk (base64)
   * - 'response.audio_transcript.delta' – partial transcript
   * - 'response.audio_transcript.done' – full transcript complete
   * - 'response.done' – turn complete
   * - 'input_audio_buffer.speech_started' – VAD detected speech
   * - 'input_audio_buffer.speech_stopped' – VAD speech ended
   * - 'conversation.item.input_audio_transcription.completed' – user transcript
   * - 'error' – API error
   */
  private handleOpenAIMessage(session: OpenAISession, data: WebSocket.Data): void {
    const event = JSON.parse(data.toString());

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        this.logger.debug(
          `OpenAI session ${event.type} for ${session.sessionId}`,
        );
        break;

      case 'response.audio.delta':
        if (event.delta) {
          /**
           * Audio chunk from OpenAI – base64 PCM 24kHz.
           * Decode to raw Buffer and emit for VoiceGateway streaming.
           * Note: OpenAI outputs 24kHz but we accept it as-is;
           * the mobile client handles sample rate conversion.
           */
          const audioBuffer = Buffer.from(event.delta, 'base64');
          session.emitter.emit('audioResponse', audioBuffer);
        }
        break;

      case 'response.audio_transcript.delta':
        if (event.delta) {
          session.emitter.emit('textResponse', event.delta);
        }
        break;

      case 'response.audio_transcript.done':
        // Full transcript available
        if (event.transcript) {
          session.emitter.emit('fullTranscript', event.transcript);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        if (event.transcript) {
          session.emitter.emit('userTranscript', event.transcript);
        }
        break;

      case 'response.done':
        session.emitter.emit('turnComplete');
        break;

      case 'input_audio_buffer.speech_started':
        session.emitter.emit('speechStarted');
        break;

      case 'input_audio_buffer.speech_stopped':
        session.emitter.emit('speechStopped');
        break;

      case 'error':
        this.logger.error(
          `OpenAI Realtime error for ${session.sessionId}: ${JSON.stringify(event.error)}`,
        );
        session.emitter.emit('error', new Error(event.error?.message || 'Unknown OpenAI error'));
        break;

      default:
        this.logger.debug(`OpenAI unhandled event: ${event.type}`);
    }
  }

  /**
   * Handle OpenAI WebSocket disconnection with retry.
   * Up to 2 retries, then emit 'fallbackToText' (final fallback).
   */
  private handleDisconnect(session: OpenAISession, systemPrompt: string): void {
    if (!session.isAlive) return;

    session.retryCount += 1;

    if (session.retryCount <= 2) {
      this.logger.warn(
        `Retrying OpenAI Realtime for session ${session.sessionId} (attempt ${session.retryCount}/2)`,
      );
      setTimeout(
        () => this.connectToOpenAI(session, systemPrompt),
        1000 * session.retryCount,
      );
    } else {
      this.logger.error(
        `OpenAI Realtime retries exhausted for session ${session.sessionId}`,
      );
      session.emitter.emit('fallbackToText');
      session.emitter.emit('close');
    }
  }

  /**
   * Stream PCM audio from client to OpenAI Realtime.
   *
   * OpenAI accepts 'input_audio_buffer.append' with base64 PCM data.
   * Input is 16kHz from the client – OpenAI handles resampling internally.
   */
  sendAudioChunk(sessionId: string, audioBuffer: Buffer): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(
        `Cannot send audio: no active OpenAI session for ${sessionId}`,
      );
      return;
    }

    try {
      const message = {
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      };
      session.ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(
        `Failed to send audio chunk for session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Commit the audio buffer to trigger a response.
   * Used after jitter buffer flush or when VAD is disabled.
   */
  commitAudioBuffer(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return;

    try {
      session.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    } catch (error) {
      this.logger.error(
        `Failed to commit audio buffer for session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Send a text prompt (used for proactive greeting or text-mode).
   * Creates a conversation item with text content and triggers a response.
   */
  sendTextPrompt(sessionId: string, prompt: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(
        `Cannot send text: no active OpenAI session for ${sessionId}`,
      );
      return;
    }

    try {
      // Create a conversation item with text
      const createItem = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
          ],
        },
      };
      session.ws.send(JSON.stringify(createItem));

      // Trigger response generation
      const createResponse = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
        },
      };
      session.ws.send(JSON.stringify(createResponse));
    } catch (error) {
      this.logger.error(
        `Failed to send text prompt for session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Cleanly terminate an OpenAI Realtime session.
   */
  closeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isAlive = false;
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      session.emitter.removeAllListeners();
      this.activeSessions.delete(sessionId);
      this.logger.log(`OpenAI Realtime session closed: ${sessionId}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [sessionId] of this.activeSessions) {
      this.closeSession(sessionId);
    }
    this.logger.log('All OpenAI Realtime sessions closed');
  }
}

/** Internal type for tracking OpenAI Realtime sessions */
interface OpenAISession {
  sessionId: string;
  emitter: EventEmitter;
  ws: WebSocket | null;
  retryCount: number;
  isAlive: boolean;
  connectStartTime: number;
}
