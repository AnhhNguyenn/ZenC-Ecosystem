import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard – Standard NestJS guard wrapping the 'jwt' Passport strategy.
 *
 * Apply to controllers/routes via @UseGuards(JwtAuthGuard) to enforce
 * that the request carries a valid, non-expired JWT.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
