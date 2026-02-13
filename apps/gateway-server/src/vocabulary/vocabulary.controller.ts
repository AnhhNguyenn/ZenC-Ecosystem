import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VocabularyService } from './vocabulary.service';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class BrowseQueryDto {
  @IsOptional()
  @IsEnum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  level?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class AddWordDto {
  @IsString()
  vocabularyId!: string;
}

class ReviewDto {
  /**
   * SM-2 quality scale 0-5:
   * 0=blackout, 1=wrong(familiar), 2=wrong(easy), 3=hard, 4=good, 5=perfect
   */
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get('catalog')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async browseCatalog(@Query() query: BrowseQueryDto) {
    return this.vocabularyService.browseCatalog(
      query.level,
      query.category,
      query.page,
      query.limit,
    );
  }

  @Get('bank')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getUserBank(
    @Request() req: { user: { sub: string } },
    @Query('mastery') mastery?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vocabularyService.getUserBank(
      req.user.sub,
      mastery,
      page,
      limit,
    );
  }

  @Post('bank/add')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async addToBank(
    @Request() req: { user: { sub: string } },
    @Body() dto: AddWordDto,
  ) {
    return this.vocabularyService.addToBank(req.user.sub, dto.vocabularyId);
  }

  @Get('review')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getDueReviews(
    @Request() req: { user: { sub: string } },
    @Query('limit') limit?: number,
  ) {
    return this.vocabularyService.getDueReviews(req.user.sub, limit);
  }

  @Post(':id/review')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async submitReview(
    @Param('id', ParseUUIDPipe) userVocabId: string,
    @Body() dto: ReviewDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.vocabularyService.submitReview(
      req.user.sub,
      userVocabId,
      dto.quality,
    );
  }
}
