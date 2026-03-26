import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from './auth.dto';
import { RedisService } from '../common/redis.service';
import { User } from '../entities/user.entity';

/**
 * JwtStrategy – Passport strategy for validating Bearer tokens.
 *
 * Design decisions:
 * - Extracts token from Authorization header (Bearer scheme), which
 *   is compatible with both HTTP and WebSocket upgrade requests.
 * - ignoreExpiration: false ensures expired tokens are rejected at
 *   the strategy level, not the application level.
 * - The validate() return value is injected into `request.user` by
 *   Passport, making it available to all downstream guards/handlers.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Called after JWT signature verification succeeds.
   * Returns the payload to be attached to request.user.
   *
   * @param payload - Decoded JWT payload
   * @returns User identity object for downstream handlers
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    try {
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const rawVersion = await this.redis.get(`auth_version:${payload.sub}`);
      const currentVersion = Number.parseInt(rawVersion ?? '0', 10);
      if (currentVersion !== (payload.tokenVersion ?? 0)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isDeleted: false },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      return {
        ...payload,
        email: user.email,
        tier: user.tier,
        status: user.status,
      };
    } catch (error) {
      this.logger.warn(`JWT validation failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
