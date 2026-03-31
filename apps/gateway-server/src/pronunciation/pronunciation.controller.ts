import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Version,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottlerUserIpGuard } from '../common/throttler-user-ip.guard';
import { PronunciationService } from './pronunciation.service';
import { IsString, MaxLength, IsOptional } from 'class-validator';

class AssessDto {
  @IsString()
  @MaxLength(2000)
  audioUrl!: string;

  @IsString()
  @MaxLength(2000)
  referenceText!: string;

  @IsOptional()
  @IsString()
  exerciseId?: string;
}

@Controller('pronunciation')
@UseGuards(JwtAuthGuard, ThrottlerUserIpGuard)
export class PronunciationController {
  constructor(private readonly pronunciationService: PronunciationService) {}

  @Post('assess')
  @Version('1')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async assess(
    @Body() dto: AssessDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.pronunciationService.requestAssessment(
      req.user.sub,
      dto.audioUrl,
      dto.referenceText,
      dto.exerciseId,
    );
  }

  @Get('result/:id')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getResult(@Param('id') assessmentId: string) {
    return this.pronunciationService.getResult(assessmentId);
  }

  @Get('problem-sounds')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getProblemSounds(@Request() req: { user: { sub: string } }) {
    return this.pronunciationService.getProblemSounds(req.user.sub);
  }
}
