import { Controller, Get, Post, Body, UseGuards, Request, Version, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { SubmitProgressDto } from './progress.dto';
import { createHash } from 'crypto';

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

    // Sort keys deterministically for the answers array
    const sortedAnswers = dto.answers.map(ans => ({
      answer: ans.answer,
      exerciseId: ans.exerciseId,
      responseTimeMs: ans.responseTimeMs
    })).sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));

    // 2. Cryptographic Zero-Trust signature verification
    const payloadStr = dto.lessonId + JSON.stringify(sortedAnswers);

    const hash = createHash('sha256')
      .update(`${payloadStr}:${dto.timestamp}:${APP_SECRET}`)
      .digest('hex');

    if (hash !== dto.signature) {
       throw new UnauthorizedException('Invalid payload signature. Cheating attempt logged.');
    }

    // 3. Delegate to business logic to calculate XP server-side securely.
    const result = await this.progressService.submitProgressAndCalculateXp(
      req.user.sub,
      dto.lessonId,
      dto.answers
    );

    return {
      success: true,
      message: 'Progress recorded securely',
      xpEarned: result.xpEarned
    };
  }
}
