/**
 * Shared DTO (Data Transfer Object) validation classes.
 *
 * Uses class-validator decorators for automatic validation
 * via NestJS's global ValidationPipe.
 */
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsInt,
  IsArray,
} from 'class-validator';

// ═══════════════════════════════════════════════════════════
// CONVERSATION DTOs
// ═══════════════════════════════════════════════════════════

export class ConversationFeedbackDto {
  @IsUUID()
  conversationId!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ConversationFeedbackBodyDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ConversationQueryDto {
  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

// ═══════════════════════════════════════════════════════════
// SOCIAL DTOs
// ═══════════════════════════════════════════════════════════

export class CompleteChallengeDto {
  @IsNumber()
  @Min(0)
  score!: number;
}

export class CompleteMissionDto {
  @IsString()
  @MinLength(1)
  missionId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  incrementBy?: number;
}

// ═══════════════════════════════════════════════════════════
// VOCABULARY CONTEXT DTOs
// ═══════════════════════════════════════════════════════════

export class VocabularyReviewDto {
  @IsUUID()
  vocabId!: string;

  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}

export class VocabularyExtractDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  transcript!: string;
}

export class VocabularyQuizAnswerDto {
  @IsString()
  word!: string;

  @IsString()
  answer!: string;
}

export class VocabularyQuizSubmitDto {
  @IsArray()
  answers!: VocabularyQuizAnswerDto[];
}

// ═══════════════════════════════════════════════════════════
// EXERCISE DTOs
// ═══════════════════════════════════════════════════════════

export class SmartExerciseSubmitDto {
  @IsEnum([
    'LISTEN_AND_TYPE',
    'WORD_ORDER',
    'CLOZE_TEST',
    'CONVERSATION_FILL',
    'ERROR_CORRECTION',
    'PICTURE_DESCRIBE',
    'SHADOWING',
    'DICTATION',
  ])
  exerciseType!: string;

  /** Payload varies by exercise type – validated by the service */
  payload!: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════
// PAGINATION DTOs
// ═══════════════════════════════════════════════════════════

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
