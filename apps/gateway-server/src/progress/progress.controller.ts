import { Controller, Get, UseGuards, Request, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('dashboard')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Request() req: { user: { sub: string } }) {
    return this.progressService.getDashboard(req.user.sub);
  }
}
