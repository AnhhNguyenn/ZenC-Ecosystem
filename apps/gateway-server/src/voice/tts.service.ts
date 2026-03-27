import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { Server } from 'socket.io';

@Injectable()
export class TtsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TtsService.name);
  private io: Server | null = null;
  private readonly CHANNEL_NAME = 'tts_audio_stream';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Register the Socket.io server instance so we can emit directly to clients
   */
  setServer(server: Server) {
    this.io = server;
  }

  async onModuleInit() {
    try {
      // Create a dedicated subscriber for binary/TTS data
      // (RedisService's default subscriber is for text JSON data)
      const sub = this.redisService.client.duplicate();
      await sub.connect();
      
      // We expect messages on 'tts_audio_stream' in the format:
      // sessionId:base64_audio_data
      await sub.subscribe(this.CHANNEL_NAME);
      sub.on('message', (channel: string, message: string) => {
        if (channel !== this.CHANNEL_NAME) return;
        
        try {
          const colonIndex = message.indexOf(':');
          if (colonIndex === -1) return;
          
          const sessionId = message.slice(0, colonIndex);
          const base64Audio = message.slice(colonIndex + 1);
          
          if (this.io) {
            // Forward the chunk to the specific socket
            // voice.gateway.ts will handle joining the socket to a room named by sessionId
            this.io.to(sessionId).emit('ai_audio_chunk', {
              audio: base64Audio,
            });
          }
        } catch (error) {
          this.logger.error('Error processing TTS stream message', error);
        }
      });
      
      this.logger.log(`Subscribed to Redis channel: ${this.CHANNEL_NAME}`);
      
      this.subscriber = sub;
    } catch (error) {
      this.logger.error('Failed to initialize TTS subscriber', error);
    }
  }

  private subscriber: any = null;

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.CHANNEL_NAME);
      await this.subscriber.quit();
    }
  }
}
