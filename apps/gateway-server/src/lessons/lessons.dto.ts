import { IsOptional, IsString, IsEnum, IsInt, IsNumber, Min, Max, IsBoolean, MaxLength, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

// ── Course DTOs ──────────────────────────────────────────────

export class CreateCourseDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsEnum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  targetLevel!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  completionXp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  targetLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// ── Unit DTOs ────────────────────────────────────────────────

export class CreateUnitDto {
  @IsString()
  courseId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  unlockThreshold?: number;
}

// ── Lesson DTOs ──────────────────────────────────────────────

export class CreateLessonDto {
  @IsString()
  unitId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsEnum(['GRAMMAR', 'VOCABULARY', 'SPEAKING', 'LISTENING', 'CONVERSATION', 'READING'])
  type!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  xpReward?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(3.0)
  difficultyMultiplier?: number;
}

/** Lesson completion request with exercise results */
export class CompleteLessonDto {
  /** Total score across all exercises (0–100) */
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  /** Time spent on the lesson in seconds */
  @IsInt()
  @Min(0)
  timeSpentSeconds!: number;
}

// ── Query DTOs ───────────────────────────────────────────────

export class CourseQueryDto {
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
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
