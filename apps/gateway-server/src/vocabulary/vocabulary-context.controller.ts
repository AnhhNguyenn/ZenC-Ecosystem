import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VocabularyReviewDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VocabularyContextService } from './vocabulary-context.service';

/**
 * VocabularyContextController – REST API for vocabulary-in-context features.
 *
 * Endpoints:
 * - GET /due          – Get vocabulary items due for review
 * - POST /review      – Submit SM-2 review result
 * - GET /quiz         – Generate vocabulary quiz
 * - GET /context/:word – Get collocations and word family
 * - GET /stats        – Get vocabulary statistics
 */
@Controller({ path: 'vocabulary/context', version: '1' })
@UseGuards(JwtAuthGuard)
export class VocabularyContextController {
  constructor(private readonly vocabCtx: VocabularyContextService) {}

  @Get('due')
  getDue(@Req() req: any, @Query('limit') limit?: string) {
    return this.vocabCtx.getDueVocabulary(req.user.userId, Number(limit) || 20);
  }

  @Post('review')
  submitReview(
    @Req() req: any,
    @Body() body: VocabularyReviewDto,
  ) {
    return this.vocabCtx.submitReview(
      req.user.userId,
      body.vocabId,
      body.quality,
    );
  }

  @Get('quiz')
  generateQuiz(@Req() req: any, @Query('size') size?: string) {
    return this.vocabCtx.generateQuiz(req.user.userId, Number(size) || 10);
  }

  @Get('context/:word')
  getWordContext(@Param('word') word: string) {
    return this.vocabCtx.getWordContext(word);
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.vocabCtx.getStats(req.user.userId);
  }
}
