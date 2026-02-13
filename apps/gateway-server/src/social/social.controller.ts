import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CompleteChallengeDto, CompleteMissionDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialService } from './social.service';

@Controller({ path: 'social', version: '1' })
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('daily-challenge')
  getDailyChallenge(@Req() req: any) {
    return this.socialService.getDailyChallenge(req.user.userId);
  }

  @Post('daily-challenge/complete')
  completeDailyChallenge(@Req() req: any, @Body() body: CompleteChallengeDto) {
    return this.socialService.completeDailyChallenge(req.user.userId, body);
  }

  @Get('daily-challenge/leaderboard')
  getDailyChallengeLeaderboard(@Query('limit') limit?: string) {
    return this.socialService.getDailyChallengeLeaderboard(Number(limit) || 20);
  }

  @Get('weekly-missions')
  getWeeklyMissions(@Req() req: any) {
    return this.socialService.getWeeklyMissions(req.user.userId);
  }

  @Patch('weekly-missions/progress')
  updateMissionProgress(
    @Req() req: any,
    @Body() body: CompleteMissionDto,
  ) {
    return this.socialService.updateMissionProgress(
      req.user.userId,
      body.missionId,
      body.incrementBy,
    );
  }
}
