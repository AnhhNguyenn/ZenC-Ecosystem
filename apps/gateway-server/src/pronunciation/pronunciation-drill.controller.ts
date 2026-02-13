import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PronunciationDrillService } from './pronunciation-drill.service';

/**
 * PronunciationDrillController – REST API for pronunciation practice drills.
 *
 * Drill Types:
 * - MINIMAL_PAIRS: Practice sounds Vietnamese learners confuse (s/sh, l/r, etc.)
 * - IPA_PHONEME: Practice individual phonemes with audio reference
 * - TONGUE_TWISTER: Fun tongue twisters for fluency
 * - INTONATION: Practice rising/falling intonation patterns
 * - STRESS_PATTERN: Word and sentence stress practice
 * - VIETNAMESE_SPECIFIC: Drills targeting common Vietnamese L1 errors
 */
@Controller({ path: 'pronunciation/drills', version: '1' })
@UseGuards(JwtAuthGuard)
export class PronunciationDrillController {
  constructor(private readonly drillService: PronunciationDrillService) {}

  @Get('minimal-pairs')
  getMinimalPairs(@Req() req: any) {
    return this.drillService.getMinimalPairs(req.user.userId);
  }

  @Get('ipa-chart')
  getIPAChart() {
    return this.drillService.getIPAChart();
  }

  @Get('tongue-twisters')
  getTongueTwisters(@Req() req: any) {
    return this.drillService.getTongueTwisters(req.user.userId);
  }

  @Get('intonation')
  getIntonationDrills(@Req() req: any) {
    return this.drillService.getIntonationDrills(req.user.userId);
  }

  @Get('stress-patterns')
  getStressPatterns(@Req() req: any) {
    return this.drillService.getStressPatterns(req.user.userId);
  }

  @Get('vietnamese-specific')
  getVietnameseSpecific(@Req() req: any) {
    return this.drillService.getVietnameseSpecificDrills(req.user.userId);
  }

  @Get('problem-sounds')
  getProblemSounds(@Req() req: any) {
    return this.drillService.getUserProblemSounds(req.user.userId);
  }

  @Post('submit')
  submitDrillResult(
    @Req() req: any,
    @Body()
    body: {
      drillType: string;
      drillId: string;
      audioBase64?: string;
      userAnswer?: string;
    },
  ) {
    return this.drillService.submitDrillResult(
      req.user.userId,
      body.drillType,
      body.drillId,
      body.audioBase64,
      body.userAnswer,
    );
  }
}
