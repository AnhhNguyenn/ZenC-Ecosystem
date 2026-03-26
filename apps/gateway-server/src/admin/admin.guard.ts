import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtPayload } from '../auth/auth.dto';

/**
 * AdminGuard – Restricts access to God Mode endpoints.
 *
 * Checks that the authenticated user attached by JwtAuthGuard has the
 * current effective tier of 'UNLIMITED'. This avoids trusting stale
 * claims from an already-issued JWT payload.
 *
 * Why not a role-based guard: The spec uses tier-based access control
 * (FREE/PRO/UNLIMITED) rather than separate role assignments. UNLIMITED
 * tier users have admin privileges per spec §15.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
      const payload = request.user;
      if (!payload?.sub) {
        throw new ForbiddenException('Authenticated user context is missing');
      }

      if (payload.tier !== 'UNLIMITED') {
        this.logger.warn(
          `Admin access denied for user ${payload.sub} (tier: ${payload.tier})`,
        );
        throw new ForbiddenException('Admin access required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`AdminGuard error: ${(error as Error).message}`);
      throw new ForbiddenException('Access denied');
    }
  }
}
