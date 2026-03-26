import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { GrantDto, RagIngestDto } from './admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * AdminController - God Mode API endpoints.
 *
 * Protected by two layers of guards:
 * 1. JwtAuthGuard validates the JWT exists and is not expired.
 * 2. AdminGuard checks that the JWT tier is UNLIMITED.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get('users/:id/audit-logs')
  async getAuditLogs(@Param('id') id: string) {
    const logs = await this.adminService.getAuditLogs(id);
    return {
      statusCode: HttpStatus.OK,
      data: logs,
    };
  }

  @Get('analytics/overview')
  async getAnalyticsOverview() {
    const overview = await this.adminService.getAnalyticsOverview();
    return {
      statusCode: HttpStatus.OK,
      data: overview,
    };
  }

  @Get('analytics/weekly')
  async getWeeklyStats() {
    const stats = await this.adminService.getWeeklyStats();
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  @Get('rag/sources')
  async getRagSources() {
    const sources = await this.adminService.listRagSources();
    return {
      statusCode: HttpStatus.OK,
      data: sources,
    };
  }

  @Post('rag/ingest')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async ingestRagDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: RagIngestDto,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const result = await this.adminService.ingestRagDocument(file, dto.sourceName);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: result,
    };
  }
}
