import { Module } from '@nestjs/common';
import { PronunciationDrillController } from './pronunciation-drill.controller';
import { PronunciationDrillService } from './pronunciation-drill.service';

/**
 * PronunciationDrillModule – Pronunciation practice drills
 * (minimal pairs, IPA, tongue twisters, intonation, Vietnamese-specific).
 *
 * Note: The existing PronunciationModule handles audio assessment via Worker.
 * This module provides the drill content and submission endpoints.
 */
@Module({
  controllers: [PronunciationDrillController],
  providers: [PronunciationDrillService],
  exports: [PronunciationDrillService],
})
export class PronunciationDrillModule {}
