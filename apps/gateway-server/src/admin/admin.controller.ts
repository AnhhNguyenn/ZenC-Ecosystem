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
}
