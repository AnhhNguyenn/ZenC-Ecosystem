import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerUserIpGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId = req.user?.sub || req.user?.userId || 'anonymous';

    // Combine IP and UserId to create a unique rate-limit key
    return `${ip}-${userId}`;
  }
}
