import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RedisService } from '../common/redis.service';
import { JwtPayload, RegisterDto, LoginDto } from './auth.dto';

/**
 * AuthService – Handles registration, login, and JWT refresh token rotation.
 *
 * Design decisions:
 * - Refresh token rotation: on each /refresh call, the old refresh token
 *   is invalidated and a new pair (access + refresh) is issued. This limits
 *   the blast radius of a stolen refresh token to a single use.
 * - Bcrypt for password hashing with configurable salt rounds (default 12).
 * - On registration, a default UserProfile is created atomically so that
 *   the Voice module can always assume a profile exists.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
  }

  /**
   * Register a new user with email + password.
   * Creates User + UserProfile atomically.
   *
   * @throws ConflictException if email already exists
   */
  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const existingUser = await this.userRepo.findOne({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }

      const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

      const user = this.userRepo.create({
        email: dto.email,
        passwordHash,
        tier: 'FREE',
        tokenBalance: 1000, // Welcome bonus: 1000 tokens
        status: 'ACTIVE',
      });

      const savedUser = await this.userRepo.save(user);

      // Create default profile atomically
      const profile = this.profileRepo.create({
        userId: savedUser.id,
        currentLevel: 'A1',
        confidenceScore: 0.5,
        vnSupportEnabled: true,
        speakingSpeedMultiplier: 1.0,
      });
      await this.profileRepo.save(profile);

      // Cache profile in Redis for fast access by VoiceGateway
      await this.redis.cacheUserProfile(savedUser.id, {
        currentLevel: 'A1',
        confidenceScore: '0.5',
        vnSupportEnabled: 'true',
        tier: 'FREE',
      });

      const tokens = await this.generateTokens(savedUser);
      await this.storeRefreshToken(savedUser.id, tokens.refreshToken);

      this.logger.log(`User registered: ${savedUser.email}`);
      return tokens;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Registration failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Authenticate user with email + password.
   * Returns a new access + refresh token pair.
   *
   * @throws UnauthorizedException on invalid credentials
   */
  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const user = await this.userRepo.findOne({
        where: { email: dto.email, isDeleted: false },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status === 'BANNED') {
        throw new UnauthorizedException('Account has been banned');
      }

      if (user.status === 'LOCKED') {
        throw new UnauthorizedException('Account is locked');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Refresh cached profile on login
      const profile = await this.profileRepo.findOne({ where: { userId: user.id } });
      if (profile) {
        await this.redis.cacheUserProfile(user.id, {
          currentLevel: profile.currentLevel,
          confidenceScore: String(profile.confidenceScore),
          vnSupportEnabled: String(profile.vnSupportEnabled),
          tier: user.tier,
        });
      }

      this.logger.log(`User logged in: ${user.email}`);
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Login failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Refresh token rotation – issues a new token pair and invalidates
   * the old refresh token.
   *
   * Why rotation: if a refresh token is stolen, the attacker gets only
   * one use. On the next legitimate refresh attempt, the hash mismatch
   * reveals the compromise and the user can be forced to re-authenticate.
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isDeleted: false },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isRefreshValid) {
        /**
         * Hash mismatch indicates potential token theft.
         * Invalidate all tokens for this user as a safety measure.
         */
        this.logger.warn(`Refresh token reuse detected for user ${user.id}`);
        await this.userRepo.update(user.id, { refreshTokenHash: null });
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Token refresh failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate access + refresh token pair.
   * Access token is short-lived (15min), refresh token is long-lived (7d).
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.tier,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Hash and store the refresh token in the User table.
   * We store the hash (not plaintext) so that a DB breach
   * doesn't directly yield usable refresh tokens.
   */
  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }
}
