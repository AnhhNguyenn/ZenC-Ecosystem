import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RedisService } from '../common/redis.service';
import { RabbitMQService } from '../common/rabbitmq.service';
import { JwtPayload, RegisterDto, LoginDto, VerifyOtpDto } from './auth.dto';

const DUMMY_PASSWORD_HASH =
  '$2b$10$6k7bRe1f4H4q.WxqnSxTiOzjll6T6hmN6xL2dMcQ4S0QxqjEWLTFK'; // bcrypt('not-the-right-password')

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: 'LEARNER' | 'ADMIN';
  tier: User['tier'];
  status: User['status'];
}

export interface AuthResultDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    this.saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
  }

  async register(dto: RegisterDto): Promise<{ userId: string; email: string }> {
    const email = this.normalizeEmail(dto.email);
    // Hash password outside of the database transaction
    const passwordHash = await bcrypt.hash(
      this.prehashPassword(dto.password),
      this.saltRounds,
    );

    try {
      const savedUser = await this.dataSource.transaction(async (manager) => {
        const transactionalUserRepo = manager.getRepository(User);
        const profileRepo = manager.getRepository(UserProfile);

        const existingUser = await transactionalUserRepo.findOne({
          where: { email },
        });

        if (existingUser) {
          throw new ConflictException('Email already registered');
        }

        // Default to UNVERIFIED and 0 tokens. Bonus is applied upon OTP verification.
        const user = transactionalUserRepo.create({
          email,
          passwordHash,
          tier: 'FREE',
          tokenBalance: 0,
          status: 'UNVERIFIED' as any,
        });

        const dbUser = await transactionalUserRepo.save(user);

        const profile = profileRepo.create({
          userId: (dbUser as User).id,
          currentLevel: 'A1',
          confidenceScore: 0.5,
          vnSupportEnabled: true,
          speakingSpeedMultiplier: 1.0,
        });

        await profileRepo.save(profile);
        return dbUser;
      });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const typedUser = savedUser as User;
      const otpKey = `auth_otp:${typedUser.id}`;
      // Store in Redis with 5 minutes TTL
      await this.redis.getClient().set(otpKey, otp, 'EX', 300);

      // Dispatch event to RabbitMQ for sending the OTP email
      await this.rabbitmq.dispatchDeepBrainTask('SEND_OTP_EMAIL', {
        userId: typedUser.id,
        email: typedUser.email,
        otp,
      });

      this.logger.log(`User registered (UNVERIFIED): ${typedUser.email}`);
      return { userId: typedUser.id, email: typedUser.email };
    } catch (error) {
      if (error instanceof ConflictException || this.isDuplicateKeyError(error)) {
        throw new ConflictException('Email already registered');
      }

      this.logger.error(
        `Registration failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResultDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'UNVERIFIED' as any) {
      throw new ConflictException('User is already verified');
    }

    const otpKey = `auth_otp:${user.id}`;
    const storedOtp = await this.redis.getClient().get(otpKey);

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let authResult!: AuthResultDto;

    try {
      // Fetch dynamic bonus config (default to 0 if not set) OUTSIDE transaction to prevent DB Lock
      const configBonus = await this.redis.getClient().get('SYSTEM_CONFIG:WELCOME_BONUS_TOKENS');
      const welcomeBonus = configBonus ? parseInt(configBonus, 10) : 0;

      await this.dataSource.transaction(async (manager) => {
        const transactionalUserRepo = manager.getRepository(User);

        await transactionalUserRepo.update(user.id, {
          status: 'ACTIVE',
          tokenBalance: () => `tokenBalance + ${welcomeBonus}`,
        });
      });

      // Delete OTP OUTSIDE transaction
      await this.redis.getClient().del(otpKey);

      // Reload user to get updated state for tokens
      const activeUser = await this.userRepo.findOneOrFail({ where: { id: user.id } });

      // Caching profile
      const profile = await this.profileRepo.findOne({ where: { userId: activeUser.id } });
      if (profile) {
        await this.redis.cacheUserProfile(activeUser.id, {
          currentLevel: profile.currentLevel,
          confidenceScore: String(profile.confidenceScore),
          vnSupportEnabled: String(profile.vnSupportEnabled),
          tier: activeUser.tier,
        });
      }

      const tokens = await this.generateTokens(activeUser);
      // Hash refreshToken outside of SQL transaction
      const hash = await bcrypt.hash(this.prehashPassword(tokens.refreshToken), 10);
      await this.userRepo.update(activeUser.id, { refreshTokenHash: hash });

      authResult = {
        ...tokens,
        user: this.toAuthUser(activeUser),
      };

      this.logger.log(`User verified and ACTIVE: ${authResult.user.email}`);
      return authResult;
    } catch (error) {
      this.logger.error(
        `OTP Verification failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResultDto> {
    const email = this.normalizeEmail(dto.email);
    const passwordInput = this.prehashPassword(dto.password);

    try {
      const user = await this.userRepo.findOne({
        where: { email, isDeleted: false },
      });

      const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
      const isPasswordValid = await bcrypt.compare(passwordInput, passwordHash);

      if (!user || !isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status === 'BANNED') {
        throw new UnauthorizedException('Account has been banned');
      }

      if (user.status === 'LOCKED') {
        throw new UnauthorizedException('Account is locked');
      }

      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Persist auth version with no TTL (fail-close security)
      const currentVersion = await this.getTokenVersion(user.id);
      await this.redis.ensureAuthVersionPersistent(user.id, currentVersion);

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
      return {
        ...tokens,
        user: this.toAuthUser(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Login failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthResultDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isDeleted: false },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.assertUserCanAuthenticate(user);

      const isRefreshValid = await bcrypt.compare(
        this.prehashPassword(refreshToken),
        user.refreshTokenHash,
      );
      if (!isRefreshValid) {
        this.logger.warn(`Refresh token reuse detected for user ${user.id}`);
        await this.invalidateUserSessions(user.id);
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return {
        ...tokens,
        user: this.toAuthUser(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(`Token refresh failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.invalidateUserSessions(userId);
  }

  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId, isDeleted: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthUser(user);
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenVersion = await this.getTokenVersion(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.tier,
      tokenVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredConfig('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(this.prehashPassword(refreshToken), 10);
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }

  private async invalidateUserSessions(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshTokenHash: null });
    await this.redis.getClient().incr(this.getTokenVersionKey(userId));
    await this.redis.removeActiveSession(userId);
  }

  private async getTokenVersion(userId: string): Promise<number> {
    const raw = await this.redis.get(this.getTokenVersionKey(userId));
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getTokenVersionKey(userId: string): string {
    return `auth_version:${userId}`;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private assertUserCanAuthenticate(user: User): void {
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Account has been banned');
    }

    if (user.status === 'LOCKED') {
      throw new UnauthorizedException('Account is locked');
    }
  }

  private prehashPassword(password: string): string {
    return createHash('sha256').update(password, 'utf8').digest('base64');
  }

  private toAuthUser(user: User): AuthUserDto {
    const emailPrefix = user.email.split('@')[0] || 'ZenC User';
    return {
      id: user.id,
      email: user.email,
      fullName: emailPrefix,
      role: 'LEARNER',
      tier: user.tier,
      status: user.status,
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is not configured`);
    }
    return value;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { number?: number; code?: string };
    return (
      driverError?.number === 2601 ||
      driverError?.number === 2627 ||
      driverError?.code === 'SQLITE_CONSTRAINT'
    );
  }
}
