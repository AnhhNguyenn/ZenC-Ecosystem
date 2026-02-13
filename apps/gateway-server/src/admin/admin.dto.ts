import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

/**
 * DTO for the God Mode grant endpoint.
 * At least one of tier or tokenGrant must be provided.
 */
export class GrantDto {
  @IsOptional()
  @IsIn(['FREE', 'PRO', 'UNLIMITED'])
  tier?: 'FREE' | 'PRO' | 'UNLIMITED';

  @IsOptional()
  @IsNumber()
  tokenGrant?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'LOCKED', 'BANNED'])
  status?: 'ACTIVE' | 'LOCKED' | 'BANNED';

  /** Mandatory audit reason per spec – every God Mode action must be justified */
  @IsString()
  reason!: string;
}
