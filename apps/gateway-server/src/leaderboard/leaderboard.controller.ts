import { Controller, Get, Query, UseGuards, Request, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('weekly')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getWeekly(
    @Request() req: { user: { sub: string } },
    @Query('limit') limit?: number,
  ) {
    return this.leaderboardService.getWeekly(req.user.sub, limit ?? 30);
  }

  @Get('all-time')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getAllTime(
    @Request() req: { user: { sub: string } },
    @Query('limit') limit?: number,
  ) {
    return this.leaderboardService.getAllTime(req.user.sub, limit ?? 30);
  }
}
