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
  NotFoundException,
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

  @Get('public/seo/:slug')
  async getSeoWord(@Param('slug') slug: string) {
    // Basic slug to word conversion
    const word = slug.replace(/-/g, ' ');
    // Assuming the database has some words in lower case or capitalized properly.
    // We'll let the service handle the query.
    // Need ILike if using Postgres, but TypeORM doesn't natively expose ILike cleanly without raw string unless we use ILike operator from TypeORM.
    // For simplicity, we just pass the raw word or a mocked representation if not found.
    const vocab = await this.vocabularyService.getSeoWord(word) || await this.vocabularyService.getSeoWord(slug);

    if (vocab) {
       return {
         word: vocab.word,
         phonetic: vocab.phonetic || '/.../',
         type: vocab.partOfSpeech || 'Word',
         meaning: vocab.translation,
         example: vocab.exampleSentence || '',
         vietnameseExample: vocab.exampleTranslation || '',
         funFact: 'Did you know? Every word has a story.', // Mocked fun fact for now
       };
    }

    // Fallback to mock data to not break the page if word is missing in DB during this stage.
    const MOCK_DB: Record<string, any> = {
      'procrastinate': {
        word: 'Procrastinate',
        phonetic: '/prəˈkræs.tə.neɪt/',
        type: 'Verb (Động từ)',
        meaning: 'Trì hoãn, chần chừ việc gì đó, đặc biệt là do lười biếng hoặc không muốn làm.',
        example: 'I always procrastinate when it comes to doing my taxes.',
        vietnameseExample: 'Tôi luôn chần chừ khi phải làm thủ tục đóng thuế.',
        funFact: 'Người La Mã cổ đại không coi "Procrastinate" là từ xấu, họ coi đó là sự chờ đợi thời cơ chín muồi!',
      },
      'serendipity': {
        word: 'Serendipity',
        phonetic: '/ˌser.ənˈdɪp.ə.t̬i/',
        type: 'Noun (Danh từ)',
        meaning: 'Sự tình cờ phát hiện ra những điều tốt đẹp, may mắn một cách không ngờ tới.',
        example: 'Finding that rare book in the dusty corner was pure serendipity.',
        vietnameseExample: 'Tìm thấy cuốn sách hiếm đó ở góc bụi bặm thực sự là một sự tình cờ may mắn.',
        funFact: 'Từ này được bình chọn là một trong những từ đẹp nhất trong tiếng Anh!',
      }
    };

    const mock = MOCK_DB[slug.toLowerCase()];
    if (mock) {
       return mock;
    }

    throw new NotFoundException('Vocabulary word not found');
  }

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
