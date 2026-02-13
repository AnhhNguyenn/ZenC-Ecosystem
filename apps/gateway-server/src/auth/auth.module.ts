import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';

/**
 * AuthModule – Encapsulates authentication concerns.
 *
 * Imports:
 * - PassportModule with 'jwt' default strategy
 * - JwtModule with async config (secret from ConfigService)
 * - TypeOrmModule for User and UserProfile repositories
 *
 * Exports:
 * - JwtStrategy (needed by guards in other modules)
 * - AuthService (needed by VoiceGateway for socket auth)
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRATION', '15m'),
        },
      }),
    }),
    TypeOrmModule.forFeature([User, UserProfile]),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
