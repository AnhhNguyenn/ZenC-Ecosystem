import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('profile')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { sub: string } }) {
    return this.gamificationService.getProfile(req.user.sub);
  }

  @Post('check-achievements')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async checkAchievements(@Request() req: { user: { sub: string } }) {
    const unlocked = await this.gamificationService.checkAchievements(req.user.sub);
    return { newlyUnlocked: unlocked, count: unlocked.length };
  }
}
