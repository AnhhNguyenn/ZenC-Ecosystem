import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllEntities } from './entities';

// ── Core Infrastructure ──────────────────────────────────────
import { RedisModule } from './common/redis.module';
import { BullModule } from '@nestjs/bullmq';

// ── Feature Modules ──────────────────────────────────────────
import { AuthModule } from './auth/auth.module';
import { VoiceModule } from './voice/voice.module';
import { AdminModule } from './admin/admin.module';
import { LessonsModule } from './lessons/lessons.module';
import { ExercisesModule } from './exercises/exercises.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { GamificationModule } from './gamification/gamification.module';
import { StreaksModule } from './streaks/streaks.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ProgressModule } from './progress/progress.module';
import { PronunciationModule } from './pronunciation/pronunciation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GdprModule } from './gdpr/gdpr.module';
import { ConversationModule } from './conversation/conversation.module';
import { PronunciationDrillModule } from './pronunciation/pronunciation-drill.module';
import { SocialModule } from './social/social.module';

/**
 * AppModule – Root module composing all feature modules.
 *
 * Module Loading Order (dependency-first):
 * 1. ConfigModule (global – env vars available everywhere)
 * 2. TypeOrmModule (global – database connection pool)
 * 3. RedisModule (global – caching, pub/sub, leaderboards)
 * 4. AuthModule (exported – JWT strategy used by all guards)
 * 5. Feature modules (independent, import auth guards internally)
 *
 * Database Configuration:
 * - MSSQL 2022 via mssql/tedious driver
 * - Connection pool: min=2, max=20 (handles 20 concurrent queries)
 * - Auto-synchronize in dev (NEVER in production – use migrations)
 * - RequestTimeout: 30s to prevent long-running query locks
 */
@Module({
  imports: [
    // ── Global Configuration ──────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    // ── Database ──────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredPoolMin = Number(config.get<string>('DB_POOL_MIN', '5'));
        const configuredPoolMax = Number(config.get<string>('DB_POOL_MAX', '50'));
        const poolMin = Number.isFinite(configuredPoolMin)
          ? Math.max(1, configuredPoolMin)
          : 5;
        const poolMax = Number.isFinite(configuredPoolMax)
          ? Math.max(poolMin, configuredPoolMax)
          : 50;

        return {
          type: 'mssql' as const,
          host: config.get<string>('MSSQL_HOST', 'localhost'),
          port: config.get<number>('MSSQL_PORT', 1433),
          username: config.get<string>('MSSQL_USER', 'sa'),
          password: config.get<string>('MSSQL_PASSWORD'),
          database: config.get<string>('MSSQL_DATABASE', 'zenc_ai'),
          entities: AllEntities,
          synchronize: false, // Rule: STRICTLY FALSE. Migrations must be used across all environments to prevent accidental drops.
          migrations: ['dist/migrations/*.js'],
          migrationsRun: config.get<string>('NODE_ENV') === 'production',
          logging: config.get<string>('NODE_ENV') === 'development',
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
          extra: {
            connectionTimeout: 30000,
            requestTimeout: 30000,
          },
          pool: {
            min: poolMin,
            max: poolMax,
          },
        };
      },
    }),

    // ── Infrastructure ────────────────────────────────────────
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      }),
    }),

    // ── Authentication (exported for guards) ──────────────────
    AuthModule,

    // ── Real-time Voice & Conversation ─────────────────────────
    VoiceModule,
    ConversationModule,

    // ── Administration ────────────────────────────────────────
    AdminModule,

    // ── Learning Platform ─────────────────────────────────────
    LessonsModule,
    ExercisesModule,
    VocabularyModule,

    // ── Engagement & Gamification ─────────────────────────────
    GamificationModule,
    StreaksModule,
    LeaderboardModule,

    // ── Analytics & Progress ──────────────────────────────────
    ProgressModule,
    PronunciationModule,
    PronunciationDrillModule,

    // ── Social ────────────────────────────────────────────────
    SocialModule,

    // ── User Experience ───────────────────────────────────────
    NotificationsModule,

    // ── Compliance ────────────────────────────────────────────
    GdprModule,
  ],
})
export class AppModule {}
