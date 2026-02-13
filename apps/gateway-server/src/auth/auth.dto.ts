import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * DTOs for the Auth module – validated by NestJS global ValidationPipe.
 *
 * Using class-validator decorators means the ValidationPipe will reject
 * malformed requests before they reach the service layer, reducing
 * attack surface and eliminating manual validation boilerplate.
 */

export class RegisterDto {
  @IsEmail()
  email!: string;

  /** Minimum 8 characters per spec §9 password policy */
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

/**
 * JWT payload shape – carried inside every access token.
 * Kept minimal to reduce token size (transmitted with every request).
 */
export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tier: string;
}
