import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './auth.dto';

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

  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
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
      return payload;
    } catch (error) {
      this.logger.warn(`JWT validation failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
