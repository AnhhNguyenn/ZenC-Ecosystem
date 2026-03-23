import {
  Controller,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { GrantDto } from './admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * AdminController – God Mode API endpoints.
 *
 * Protected by two layers of guards:
 * 1. JwtAuthGuard – validates the JWT exists and is not expired
 * 2. AdminGuard – checks that the JWT tier is UNLIMITED
 *
 * Per spec §5.5: PATCH /admin/users/:id/grant
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Grant tier upgrade, tokens, or status change to a user.
   *
   * @param id - Target user UUID
   * @param dto - Changes to apply (tier, tokenGrant, status) + mandatory reason
   * @returns Updated user data
   */
  @Patch('users/:id/grant')
  async grantToUser(
    @Param('id') id: string,
    @Body() dto: GrantDto,
    @Req() req: { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    const updatedUser = await this.adminService.grantToUser(adminId, id, dto);

    return {
      statusCode: HttpStatus.OK,
      message: 'User updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
        tokenBalance: updatedUser.tokenBalance,
        status: updatedUser.status,
      },
    };
  }

  /**
   * Retrieve audit logs for a specific user.
   * Useful for compliance review and investigating admin actions.
   */
  @Get('users/:id/audit-logs')
  async getAuditLogs(@Param('id') id: string) {
    const logs = await this.adminService.getAuditLogs(id);
    return {
      statusCode: HttpStatus.OK,
      data: logs,
    };
  }

  /**
   * Get platform analytics overview for the Admin Dashboard.
   * Returns real aggregated stats: total users, active 24h, MRR, growth %.
   */
  @Get('analytics/overview')
  async getAnalyticsOverview() {
    const overview = await this.adminService.getAnalyticsOverview();
    return {
      statusCode: HttpStatus.OK,
      data: overview,
    };
  }

  /**
   * Get weekly time-series (last 8 weeks) for the Admin Dashboard chart.
   * Returns per-week: new users + voice sessions started.
   */
  @Get('analytics/weekly')
  async getWeeklyStats() {
    const stats = await this.adminService.getWeeklyStats();
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }
}
