import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RedisService } from '../common/redis.service';

/**
 * MultiLoginGuard – WebSocket-specific guard for preventing concurrent sessions.
 *
 * While the VoiceGateway handles multi-login detection inline during
 * handleConnection, this guard can be applied to individual WebSocket
 * message handlers for additional protection.
 *
 * Logic:
 * - Check Redis `active_session:{userId}` for each message
 * - If the stored socket ID doesn't match the current client → reject
 *
 * This catches edge cases where a second connection was established
 * between the first connection's handlers.
 */
@Injectable()
export class MultiLoginGuard implements CanActivate {
  private readonly logger = new Logger(MultiLoginGuard.name);

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const data = context.switchToWs().getData();

      // Extract userId from socket data or handshake
      const userId = (client as Socket & { userId?: string }).userId || data?.userId;

      if (!userId) {
        // Cannot verify without userId; allow (auth guard will catch)
        return true;
      }

      const activeSocketId = await this.redis.getActiveSession(userId);

      if (activeSocketId && activeSocketId !== client.id) {
        this.logger.warn(
          `Multi-login blocked: user ${userId} active on ${activeSocketId}, current ${client.id}`,
        );
        throw new WsException('Session active on another device');
      }

      return true;
    } catch (error) {
      if (error instanceof WsException) throw error;
      this.logger.error(`MultiLoginGuard error: ${(error as Error).message}`);
      // Don't block on Redis failures
      return true;
    }
  }
}
