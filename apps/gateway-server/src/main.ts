import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { initSentry } from './common/sentry.config';
import { RedisIoAdapter } from './common/redis-io.adapter';

// Initialize Sentry before anything else to capture bootstrap errors
initSentry();

/**
 * Bootstrap the ZenC AI Gateway Server.
 *
 * Configuration choices:
 * - URI versioning (/api/v1/...) per spec §13 for 90-day deprecation support.
 * - Global ValidationPipe with whitelist strips unknown properties from DTOs,
 *   preventing injection of unexpected fields.
 * - CORS enabled for development; restrict origins in production.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ── API Versioning ──────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── WebSockets Scaling (Redis Adapter) ──────────────────────
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(process.env.REDIS_URL || 'redis://localhost:6379');
  app.useWebSocketAdapter(redisIoAdapter);

  // ── Global Pipes ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Exception Filter ─────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://zenc.ai']
      : true,
    credentials: true,
  });

  const port = process.env.GATEWAY_PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 ZenC Gateway Server running on port ${port}`);
  logger.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
