import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  lessonId!: string;

  @IsEnum(['MCQ', 'FILL_BLANK', 'SPEAKING', 'LISTENING', 'REORDER', 'MATCHING'])
  type!: string;

  @IsString()
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsString()
  optionsJson?: string;

  @IsString()
  @MaxLength(2000)
  correctAnswer!: string;

  @IsOptional()
  @IsString()
  acceptableAnswersJson?: string;

  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  hintVi?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SubmitAnswerDto {
  /** The user's answer – sanitized server-side before comparison */
  @IsString()
  @MaxLength(2000)
  answer!: string;

  /** Client-reported response time in ms; server validates plausibility */
  @IsInt()
  @Min(0)
  @Max(300000) // Max 5 minutes
  responseTimeMs!: number;
}

export class DailyMixQueryDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  count?: number = 15;
}
