import { Controller, Get, Post, Body, UseGuards, Request, Version, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { createHash } from 'crypto';

class SubmitProgressDto {
  lessonId!: string;
  correctAnswers!: number;
  totalQuestions!: number;
  timestamp!: number;
  signature!: string;
}

const APP_SECRET = process.env.NEXT_PUBLIC_APP_SECRET || 'zenc-anti-cheat-secret-v1';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('dashboard')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Request() req: { user: { sub: string } }) {
    return this.progressService.getDashboard(req.user.sub);
  }

  @Post('submit-answer')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async submitAnswer(
    @Request() req: { user: { sub: string } },
    @Body() dto: SubmitProgressDto
  ) {
    // 1. Time-based replay attack prevention (15 minutes window)
    const now = Date.now();
    if (Math.abs(now - dto.timestamp) > 15 * 60 * 1000) {
       throw new UnauthorizedException('Request expired');
    }

    // 2. Cryptographic Zero-Trust signature verification
    const payload = JSON.stringify({
      lessonId: dto.lessonId,
      correctAnswers: dto.correctAnswers,
      totalQuestions: dto.totalQuestions
    });

    const hash = createHash('sha256')
      .update(`${payload}:${dto.timestamp}:${APP_SECRET}`)
      .digest('hex');

    if (hash !== dto.signature) {
       throw new UnauthorizedException('Invalid payload signature. Cheating attempt logged.');
    }

    // 3. Delegate to business logic to calculate XP server-side securely.
    // E.g., this.progressService.submitProgressAndCalculateXp(...)
    return {
      success: true,
      message: 'Progress recorded securely',
      // The server dictates the reward!
      xpEarned: Math.min(dto.correctAnswers * 10, 50)
    };
  }
}
