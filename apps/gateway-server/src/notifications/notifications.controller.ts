import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @Request() req: { user: { sub: string } },
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getNotifications(
      req.user.sub,
      limit ?? 20,
      unreadOnly === 'true',
    );
  }

  @Patch(':id/read')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Param('id', ParseUUIDPipe) notifId: string,
    @Request() req: { user: { sub: string } },
  ) {
    await this.notificationsService.markAsRead(req.user.sub, notifId);
    return { success: true };
  }

  @Post('read-all')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async markAllRead(@Request() req: { user: { sub: string } }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
