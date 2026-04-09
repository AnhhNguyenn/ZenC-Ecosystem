import { IsEmail, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTOs for the Auth module.
 *
 * Tight length limits prevent validation and parsing from doing
 * unnecessary work on oversized payloads.
 */

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_MSG = 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt';

export class RegisterDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  password!: string;
}

export class LoginDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsNotEmpty()
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
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsNotEmpty()
  @IsNumberString({}, { message: 'OTP chỉ được chứa các chữ số' })
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class ResendOtpDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsNotEmpty()
  @IsNumberString({}, { message: 'OTP chỉ được chứa các chữ số' })
  @MinLength(6)
  @MaxLength(6)
  otp!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class SocialLoginDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(4096)
  token!: string; // Google ID Token or Apple Identity Token
}

export interface JwtPayload {
  sub: string;
  email: string;
  tier: string;
  tokenVersion: number;
  status?: 'ACTIVE' | 'LOCKED' | 'BANNED';
  jti?: string;
}
