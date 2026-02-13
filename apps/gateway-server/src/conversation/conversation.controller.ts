import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ConversationFeedbackBodyDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';

/**
 * ConversationController – REST API for conversation management.
 *
 * All endpoints require JWT authentication.
 * UserId is extracted from the JWT payload (req.user.userId).
 *
 * Endpoints:
 * - GET  /v1/conversations          – Paginated history
 * - GET  /v1/conversations/stats    – Conversation analytics
 * - GET  /v1/conversations/:id      – Full conversation details
 * - GET  /v1/conversations/:id/transcript – Annotated transcript
 * - GET  /v1/conversations/:id/score     – Post-session scores
 * - POST /v1/conversations/:id/feedback  – User quality rating
 */
@Controller({ path: 'conversations', version: '1' })
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async getHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationService.getHistory(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 50) : 10,
    );
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.conversationService.getStats(req.user.userId);
  }

  @Get(':id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const conv = await this.conversationService.getConversation(
      id,
      req.user.userId,
    );
    if (!conv) {
      return { error: 'Conversation not found' };
    }
    return conv;
  }

  @Get(':id/transcript')
  async getTranscript(@Req() req: any, @Param('id') id: string) {
    const transcript = await this.conversationService.getTranscript(
      id,
      req.user.userId,
    );
    if (!transcript) {
      return { error: 'Transcript not found' };
    }
    return transcript;
  }

  @Get(':id/score')
  async getScore(@Req() req: any, @Param('id') id: string) {
    const score = await this.conversationService.getScore(
      id,
      req.user.userId,
    );
    if (!score) {
      return { error: 'Score not available yet', status: 'PENDING' };
    }
    return score;
  }

  @Post(':id/feedback')
  async submitFeedback(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ConversationFeedbackBodyDto,
  ) {
    await this.conversationService.submitFeedback(
      id,
      req.user.userId,
      body.rating,
      body.comment,
    );
    return { message: 'Feedback submitted. Thank you!' };
  }
}
