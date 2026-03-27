import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { initSentry } from './common/sentry.config';
import { RedisIoAdapter } from './common/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.set('trust proxy', 1);

  initSentry({
    dsn: configService.get<string>('SENTRY_DSN'),
    environment: configService.get<string>('NODE_ENV') ?? 'development',
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const configuredOrigins = configService.get<string>(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3001,http://localhost:3002',
  );
  const corsOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOptions = { origin: corsOrigins, credentials: true };
  app.enableCors(corsOptions);

  const redisIoAdapter = new RedisIoAdapter(app, corsOptions);
  const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
  const redisPort = configService.get<string>('REDIS_PORT', '6379');
  const redisPassword = configService.get<string>('REDIS_PASSWORD', '');
  const redisUrl = redisPassword
    ? `redis://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}`
    : `redis://${redisHost}:${redisPort}`;
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = configService.get<string>('GATEWAY_PORT', '3000');
  await app.listen(port);
  logger.log(`ZenC Gateway Server running on port ${port}`);
  logger.log(`Environment: ${configService.get<string>('NODE_ENV') ?? 'development'}`);
}

bootstrap();
