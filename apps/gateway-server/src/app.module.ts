import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AllEntities } from './entities';

// ── Core Infrastructure ──────────────────────────────────────
import { RedisModule } from './common/redis.module';
import { RabbitMQModule } from './common/rabbitmq.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

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
import { PaymentsModule } from './payments/payments.module';
import { StorageModule } from './storage/storage.module';
import { ProfileModule } from './profile/profile.module';

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
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredPoolMax = Number(config.get<string>('DB_POOL_MAX', '50'));
        const poolMax = Number.isFinite(configuredPoolMax)
          ? Math.max(5, configuredPoolMax)
          : 50;

        const baseConfig = {
          type: 'postgres' as const,
          entities: AllEntities,
          synchronize: false, // Rule: STRICTLY FALSE. Migrations must be used across all environments to prevent accidental drops.
          migrations: ['dist/migrations/*.js'],
          migrationsRun: config.get<string>('NODE_ENV') === 'production',
          logging: config.get<string>('NODE_ENV') === 'development',
          poolErrorHandler: (err: Error) => {
            console.error('TypeORM Pool Error:', err);
          },
          pool: {
            prepared_statement: false,
          },
          extra: {
            max: poolMax,
            connectionTimeoutMillis: 30000,
            statement_timeout: 10000,
            query_timeout: 10000,
          },
          useUTC: true,
        };

        // CQRS: Use replication if replica is configured
        const replicaHost = config.get<string>('PG_REPLICA_HOST');
        if (replicaHost) {
          return {
            ...baseConfig,
            replication: {
              master: {
                host: config.get<string>('PG_HOST', 'localhost'),
                port: config.get<number>('PG_PORT', 5432),
                username: config.get<string>('PG_USER', 'postgres'),
                password: config.get<string>('PG_PASSWORD'),
                database: config.get<string>('PG_DATABASE', 'zenc_ai'),
              },
              slaves: [{
                host: replicaHost,
                port: config.get<number>('PG_REPLICA_PORT', 5432),
                username: config.get<string>('PG_USER', 'postgres'),
                password: config.get<string>('PG_PASSWORD'),
                database: config.get<string>('PG_DATABASE', 'zenc_ai'),
              }],
            },
          };
        }

        return {
          ...baseConfig,
          host: config.get<string>('PG_HOST', 'localhost'),
          port: config.get<number>('PG_PORT', 5432),
          username: config.get<string>('PG_USER', 'postgres'),
          password: config.get<string>('PG_PASSWORD'),
          database: config.get<string>('PG_DATABASE', 'zenc_ai'),
        };
      },
    }),

    // ── Infrastructure ────────────────────────────────────────
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');
        const tlsEnabled = config.get<string>('REDIS_TLS') === 'true';

        const redisOptions: any = {
          host,
          port,
          password,
        };

        if (tlsEnabled) {
          redisOptions.tls = {};
        }

        const redisClient = new Redis(redisOptions);

        return {
          throttlers: [
            {
              ttl: 60000,
              limit: 100,
            },
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
        };
      },
    }),
    RedisModule,
    RabbitMQModule,
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

    // ── Subscriptions & Files ─────────────────────────────────
    PaymentsModule,
    StorageModule,
    ProfileModule,
  ],
})
export class AppModule {}
