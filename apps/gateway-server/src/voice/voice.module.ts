import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VoiceGateway } from './voice.gateway';
import { GeminiService } from './gemini.service';
import { OpenAIRealtimeService } from './openai-realtime.service';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { Session } from '../entities/session.entity';

/**
 * VoiceModule – Encapsulates the dual-AI real-time audio pipeline.
 *
 * Components:
 * - GeminiService: WebSocket connections to Gemini 2.5 Flash (primary)
 * - OpenAIRealtimeService: WebSocket connections to OpenAI Realtime (fallback)
 * - VoiceGateway: Socket.io gateway with provider failover & conversation modes
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, Session]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }

        return {
          secret,
        };
      },
    }),
  ],
  providers: [VoiceGateway, GeminiService, OpenAIRealtimeService],
  exports: [GeminiService, OpenAIRealtimeService],
})
export class VoiceModule {}

