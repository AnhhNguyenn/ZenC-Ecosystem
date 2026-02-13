import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Request,
  Version,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GdprService } from './gdpr.service';

/**
 * GdprController – Privacy compliance endpoints.
 *
 * All endpoints are user-scoped (can only access own data).
 * Admin access to other users' data requires separate admin endpoints
 * with additional audit logging.
 */
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  /**
   * GDPR Article 15 + 20: Export all personal data.
   * Returns a JSON document containing all stored data for this user.
   */
  @Get('export')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async exportData(@Request() req: { user: { sub: string } }) {
    return this.gdprService.exportUserData(req.user.sub);
  }

  /**
   * GDPR Article 17: Delete account and all associated data.
   * WARNING: This action is IRREVERSIBLE.
   */
  @Delete('account')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Request() req: { user: { sub: string } }) {
    return this.gdprService.deleteAccount(req.user.sub);
  }
}
