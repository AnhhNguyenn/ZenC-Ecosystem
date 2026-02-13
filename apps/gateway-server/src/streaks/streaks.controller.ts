import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StreaksService } from './streaks.service';
import { IsInt, IsIn } from 'class-validator';

class SetTargetDto {
  @IsInt()
  @IsIn([10, 20, 50, 100])
  xpTarget!: number;
}

@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get('current')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getStreak(@Request() req: { user: { sub: string } }) {
    return this.streaksService.getStreak(req.user.sub);
  }

  @Post('freeze')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async useFreeze(@Request() req: { user: { sub: string } }) {
    return this.streaksService.useFreeze(req.user.sub);
  }

  @Get('daily-goal')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getDailyGoal(@Request() req: { user: { sub: string } }) {
    return this.streaksService.getDailyGoal(req.user.sub);
  }

  @Patch('daily-goal/target')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async setDailyTarget(
    @Request() req: { user: { sub: string } },
    @Body() dto: SetTargetDto,
  ) {
    return this.streaksService.setDailyTarget(req.user.sub, dto.xpTarget);
  }

  @Get('weekly-history')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getWeekHistory(@Request() req: { user: { sub: string } }) {
    return this.streaksService.getWeekHistory(req.user.sub);
  }
}
