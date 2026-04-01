import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTOs for the Auth module.
 *
 * Tight length limits prevent validation and parsing from doing
 * unnecessary work on oversized payloads.
 */
export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(256)
  password!: string;
}

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tier: string;
  tokenVersion: number;
  status?: 'ACTIVE' | 'LOCKED' | 'BANNED';
  jti?: string;
}
