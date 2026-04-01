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
import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RedisService } from '../common/redis.service';
import { RabbitMQService } from '../common/rabbitmq.service';
import { JwtPayload, RegisterDto, LoginDto, VerifyOtpDto, ForgotPasswordDto, ResetPasswordDto, SocialLoginDto } from './auth.dto';
import * as nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';

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

  async register(dto: RegisterDto, deviceId?: string, ipAddress?: string): Promise<{ userId: string; email: string }> {
    // Anti-Fraud check: limit registration/OTP per IP/Device
    await this.checkRateLimit(`register_otp`, ipAddress || 'unknown_ip', deviceId);

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

      // Also send directly if email is configured (Fallback for missing worker)
      await this.sendEmailOtp(typedUser.email, otp, 'register');

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

  async verifyOtp(dto: VerifyOtpDto, deviceId?: string, ipAddress?: string): Promise<AuthResultDto> {
    // Check if OTP verified on multiple devices to prevent abuse
    await this.checkRateLimit('verify_otp', ipAddress || 'unknown_ip', deviceId, 10);
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

      // Security: Multi-login kick-out. Increment auth version on new login to invalidate old tokens/sockets
      const newVersion = await this.redis.getClient().incr(this.getTokenVersionKey(user.id));
      await this.redis.removeActiveSession(user.id);

      const tokens = await this.generateTokens(user);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Persist auth version with no TTL (fail-close security)
      await this.redis.ensureAuthVersionPersistent(user.id, newVersion);

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

  // ═══════════════════════════════════════════════════════════════
  // BỐI CẢNH 1: HỆ THỐNG FORGOT PASSWORD (QUÊN MẬT KHẨU)
  // ═══════════════════════════════════════════════════════════════

  async forgotPassword(dto: ForgotPasswordDto, deviceId?: string, ipAddress?: string): Promise<void> {
    // Tối đa 3 OTP trong 15 phút theo IP hoặc DeviceID
    await this.checkRateLimit(`forgot_password`, ipAddress || 'unknown_ip', deviceId);

    const user = await this.userRepo.findOne({ where: { email: dto.email, isDeleted: false } });
    if (!user) {
      // Return success anyway to prevent email enumeration (Security Best Practice)
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `auth:forgot_otp:${user.id}`;
    // 15 phút TTL
    await this.redis.getClient().set(otpKey, otp, 'EX', 900);

    await this.sendEmailOtp(user.email, otp, 'reset_password');
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email: dto.email, isDeleted: false } });
    if (!user) throw new UnauthorizedException('Invalid OTP or email');

    const otpKey = `auth:forgot_otp:${user.id}`;
    const cachedOtp = await this.redis.getClient().get(otpKey);

    if (!cachedOtp || cachedOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(this.saltRounds);
    const hash = await bcrypt.hash(dto.newPassword, salt);

    user.passwordHash = hash;
    await this.userRepo.save(user);

    // Xóa OTP
    await this.redis.getClient().del(otpKey);

    // Global Revoke tất cả Session cũ của User này
    await this.revokeTokens(user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  // BỐI CẢNH 1.3: SOCIAL LOGIN (SSO)
  // ═══════════════════════════════════════════════════════════════

  async socialLogin(dto: SocialLoginDto, provider: 'google' | 'apple'): Promise<AuthResultDto> {
    let decodedEmail: string | undefined;

    if (provider === 'google') {
      const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
      if (!clientId) {
        throw new UnauthorizedException('Google Login is not configured');
      }
      const client = new OAuth2Client(clientId);
      try {
        const ticket = await client.verifyIdToken({
          idToken: dto.token,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        decodedEmail = payload?.email;
      } catch (e) {
        throw new UnauthorizedException('Invalid Google ID Token');
      }
    } else if (provider === 'apple') {
      // In a real production scenario, use apple-signin-auth to verify the identityToken
      // For now, decode the JWT directly (assuming validation is handled by an API Gateway or will be implemented)
      try {
        const payload = this.jwtService.decode(dto.token) as any;
        decodedEmail = payload?.email;
      } catch (e) {
        throw new UnauthorizedException('Invalid Apple Identity Token');
      }
    }

    if (!decodedEmail) {
      throw new UnauthorizedException(`Failed to extract email from ${provider} token`);
    }

    let user = await this.userRepo.findOne({ where: { email: decodedEmail, isDeleted: false } });

    if (!user) {
      // Tự động tạo user mới nếu chưa có (Zero-friction Onboarding)
      user = this.userRepo.create({
        email: decodedEmail,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        status: 'ACTIVE',
        tier: 'FREE',
        emailVerified: true,
      });
      await this.userRepo.save(user);
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toAuthUser(user),
    };
  }

  // Tiện ích để hỗ trợ hàm resetPassword Global Revoke
  private async revokeTokens(userId: string): Promise<void> {
    await this.invalidateUserSessions(userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // TIỆN ÍCH BẢO MẬT & GỬI EMAIL
  // ═══════════════════════════════════════════════════════════════

  private async checkRateLimit(action: string, ip: string, deviceId?: string, maxLimit = 3): Promise<void> {
    const identifier = deviceId || ip;
    const rateKey = `rate_limit:${action}:${identifier}`;

    const count = await this.redis.getClient().incr(rateKey);
    if (count === 1) {
      await this.redis.getClient().expire(rateKey, 15 * 60); // 15 phút
    }

    if (count > maxLimit) {
      throw new UnauthorizedException('Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.');
    }
  }

  private async sendEmailOtp(email: string, otp: string, type: 'register' | 'reset_password'): Promise<void> {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<number>('SMTP_PORT', 587);
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    // Mặc định không gửi mail nếu thiếu config, giả lập log console.
    if (!smtpHost || !smtpUser) {
      this.logger.log(`[MOCK EMAIL to ${email}] OTP cho ${type}: ${otp}`);
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const subject = type === 'register' ? 'ZenC - Mã xác thực đăng ký' : 'ZenC - Khôi phục mật khẩu';
      const text = `Mã OTP của bạn là: ${otp}. Vui lòng không chia sẻ mã này cho bất kỳ ai. Mã có hiệu lực trong 15 phút.`;

      await transporter.sendMail({
        from: '"ZenC Support" <support@zenc.ai>',
        to: email,
        subject,
        text,
      });
      this.logger.log(`Sent ${type} OTP email to ${email}`);
    } catch (e) {
      this.logger.error(`Failed to send OTP email: ${e}`);
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
    const jti = crypto.randomUUID(); // Add JWT ID for specific revokes
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tier: user.tier,
      tokenVersion,
      jti,
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
