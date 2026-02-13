import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * AdminGuard – Restricts access to God Mode endpoints.
 *
 * Checks that the authenticated user's JWT `tier` claim is 'UNLIMITED'
 * (which maps to the ADMIN tier in the spec). This is a secondary check
 * on top of JwtAuthGuard – the request must have a valid JWT AND the
 * user must be an admin.
 *
 * Why not a role-based guard: The spec uses tier-based access control
 * (FREE/PRO/UNLIMITED) rather than separate role assignments. UNLIMITED
 * tier users have admin privileges per spec §15.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        throw new ForbiddenException('No authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      if (payload.tier !== 'UNLIMITED') {
        this.logger.warn(
          `Admin access denied for user ${payload.sub} (tier: ${payload.tier})`,
        );
        throw new ForbiddenException('Admin access required');
      }

      // Attach payload to request for downstream use
      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`AdminGuard error: ${(error as Error).message}`);
      throw new ForbiddenException('Access denied');
    }
  }
}
