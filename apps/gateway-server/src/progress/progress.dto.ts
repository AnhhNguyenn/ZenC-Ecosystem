import { IsString, IsArray, ValidateNested, IsInt, Min, Max, MaxLength, IsUUID, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitAnswerItemDto {
  @IsUUID()
  exerciseId!: string;

  @IsString()
  @MaxLength(2000)
  answer!: string;

  @IsInt()
  @Min(0)
  @Max(300000)
  responseTimeMs!: number;
}

export class SubmitProgressDto {
  @IsUUID()
  lessonId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerItemDto)
  answers!: SubmitAnswerItemDto[];

  @IsInt()
  timestamp!: number;

  @IsString()
  signature!: string;
}
