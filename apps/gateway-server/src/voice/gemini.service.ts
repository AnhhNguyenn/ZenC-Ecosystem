import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * GeminiService – Bi-directional WebSocket client connecting to
 * Google Gemini 2.5 Flash Native Audio.
 *
 * Architecture:
 * - Each active voice session gets its own WebSocket connection to Gemini.
 * - Audio flows entirely in RAM via Buffer/Stream (no disk writes) to meet
 *   the <500ms end-to-end latency KPI (spec §5.1).
 * - Implements retry logic (2 attempts) with text-mode fallback per spec §16.
 *
 * Why event-based: The VoiceGateway subscribes to 'audioResponse' and
 * 'textResponse' events rather than polling, enabling true streaming
 * without blocking the event loop.
 */
@Injectable()
export class GeminiService implements OnModuleDestroy {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly wsUrl: string;
  private readonly activeSessions = new Map<string, GeminiSession>();

  /** Health tracking for dual-provider fallback */
  private lastError: string | null = null;
  private lastLatencyMs = 0;
  private consecutiveFailures = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    this.model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.wsUrl = this.config.get<string>(
      'GEMINI_WS_URL',
      'wss://generativelanguage.googleapis.com/ws',
    );
  }

  /**
   * Check if this provider is healthy and available.
   * Used by VoiceGateway for provider selection.
   */
  isHealthy(): boolean {
    return this.apiKey.length > 0 && this.consecutiveFailures < 3;
  }

  getStatus(): { isHealthy: boolean; latencyMs: number; lastError: string | null } {
    return {
      isHealthy: this.isHealthy(),
      latencyMs: this.lastLatencyMs,
      lastError: this.lastError,
    };
  }

  /**
   * Create a new Gemini session for a voice conversation.
   * Returns an EventEmitter that the VoiceGateway subscribes to.
   *
   * Events emitted:
   * - 'audioResponse' (Buffer) – streamed audio chunk from Gemini
   * - 'textResponse' (string) – transcript of Gemini's response
   * - 'error' (Error) – connection or processing error
   * - 'close' – session terminated
   *
   * @param sessionId - Unique session identifier for tracking
   * @param systemPrompt - Adaptive system prompt based on user's confidence level
   */
  createSession(sessionId: string, systemPrompt: string): EventEmitter {
    const emitter = new EventEmitter();
    const session: GeminiSession = {
      sessionId,
      emitter,
      ws: null,
      retryCount: 0,
      isAlive: true,
    };

    this.activeSessions.set(sessionId, session);
    this.connectToGemini(session, systemPrompt);

    return emitter;
  }

  /**
   * Establish WebSocket connection to Gemini Live API.
   *
   * The connection URL includes the API key and model as query parameters.
   * On successful connection, we send the initial setup message with the
   * system prompt and audio configuration (PCM 16-bit, 16kHz, mono).
   */
  private connectToGemini(session: GeminiSession, systemPrompt: string): void {
    try {
      const url = `${this.wsUrl}?key=${this.apiKey}&model=${this.model}`;
      const ws = new WebSocket(url);
      session.ws = ws;
      const connectStart = Date.now();

      ws.on('open', () => {
        this.lastLatencyMs = Date.now() - connectStart;
        this.consecutiveFailures = 0;
        this.lastError = null;
        this.logger.log(`Gemini WS connected for session ${session.sessionId} (${this.lastLatencyMs}ms)`);

        // Send setup message with system prompt and audio configuration
        const setupMessage = {
          setup: {
            model: `models/${this.model}`,
            generationConfig: {
              responseModalities: ['AUDIO', 'TEXT'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          },
        };

        ws.send(JSON.stringify(setupMessage));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          this.handleGeminiMessage(session, data);
        } catch (error) {
          this.logger.error(
            `Error processing Gemini message for session ${session.sessionId}`,
            (error as Error).stack,
          );
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        this.logger.log(
          `Gemini WS closed for session ${session.sessionId}: ${code} ${reason.toString()}`,
        );
        this.handleDisconnect(session, systemPrompt);
      });

      ws.on('error', (error: Error) => {
        this.consecutiveFailures++;
        this.lastError = error.message;
        this.logger.error(
          `Gemini WS error for session ${session.sessionId}: ${error.message}`,
        );
        session.emitter.emit('error', error);
      });
    } catch (error) {
      this.consecutiveFailures++;
      this.lastError = (error as Error).message;
      this.logger.error(`Failed to connect to Gemini: ${(error as Error).message}`);
      session.emitter.emit('error', error);
    }
  }

  /**
   * Parse incoming Gemini WebSocket messages.
   *
   * Gemini streams responses as JSON messages containing either:
   * - Audio data (base64 encoded PCM) → decoded to Buffer, emitted as 'audioResponse'
   * - Text data → emitted as 'textResponse'
   *
   * Using Buffer.from(base64, 'base64') keeps everything in RAM –
   * no intermediate files are written to satisfy the latency constraint.
   */
  private handleGeminiMessage(session: GeminiSession, data: WebSocket.Data): void {
    const message = JSON.parse(data.toString());

    // Handle setup complete acknowledgment
    if (message.setupComplete) {
      this.logger.debug(`Gemini setup complete for session ${session.sessionId}`);
      return;
    }

    // Handle server content (audio/text responses)
    if (message.serverContent) {
      const parts = message.serverContent.modelTurn?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.data) {
          /**
           * Audio chunk received – decode from base64 to raw Buffer.
           * No disk write: Buffer lives in V8 heap until garbage collected
           * after it's streamed to the client via Socket.io.
           */
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          session.emitter.emit('audioResponse', audioBuffer);
        }

        if (part.text) {
          session.emitter.emit('textResponse', part.text);
        }
      }

      // Check if this is the end of the turn
      if (message.serverContent.turnComplete) {
        session.emitter.emit('turnComplete');
      }
    }
  }

  /**
   * Handle Gemini WebSocket disconnection with retry logic.
   *
   * Per spec §16 (Model Fallback Strategy):
   * 1. Retry connection up to 2 times
   * 2. If retries exhausted → emit 'fallbackToText' so the gateway
   *    can switch to text-only mode
   */
  private handleDisconnect(session: GeminiSession, systemPrompt: string): void {
    if (!session.isAlive) return;

    session.retryCount += 1;

    if (session.retryCount <= 2) {
      this.logger.warn(
        `Retrying Gemini connection for session ${session.sessionId} (attempt ${session.retryCount}/2)`,
      );
      setTimeout(() => this.connectToGemini(session, systemPrompt), 1000 * session.retryCount);
    } else {
      this.logger.error(
        `Gemini retries exhausted for session ${session.sessionId}, falling back to text mode`,
      );
      session.emitter.emit('fallbackToText');
      session.emitter.emit('close');
    }
  }

  /**
   * Stream raw PCM audio from the client to Gemini.
   *
   * Audio is sent as a JSON message with base64-encoded inline data.
   * The MIME type 'audio/pcm' with parameters matches the spec §5.1
   * format (PCM 16-bit, 16kHz, mono).
   */
  sendAudioChunk(sessionId: string, audioBuffer: Buffer): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot send audio: no active Gemini session for ${sessionId}`);
      return;
    }

    try {
      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: audioBuffer.toString('base64'),
            },
          ],
        },
      };

      session.ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(
        `Failed to send audio chunk for session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate a text-based response from Gemini (used for proactive greeting
   * and text-mode fallback). Sends a text prompt and collects the streamed response.
   *
   * @param sessionId - Session to send the prompt on
   * @param prompt - Text prompt to send to Gemini
   */
  sendTextPrompt(sessionId: string, prompt: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot send text: no active Gemini session for ${sessionId}`);
      return;
    }

    try {
      const message = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          turnComplete: true,
        },
      };

      session.ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(
        `Failed to send text prompt for session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Cleanly terminate a Gemini session.
   * Closes the WebSocket and removes from tracking map.
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
      this.logger.log(`Gemini session closed: ${sessionId}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [sessionId] of this.activeSessions) {
      this.closeSession(sessionId);
    }
    this.logger.log('All Gemini sessions closed');
  }
}

/** Internal type tracking a single Gemini WebSocket session */
interface GeminiSession {
  sessionId: string;
  emitter: EventEmitter;
  ws: WebSocket | null;
  retryCount: number;
  isAlive: boolean;
}
