import { Controller, Post, Body, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './auth.dto';

/**
 * AuthController – Public endpoints for user authentication.
 *
 * All endpoints are unguarded (no JWT required) because they are
 * the entry points for obtaining tokens. The /refresh endpoint
 * validates the refresh token internally.
 *
 * Versioned under /api/v1/auth per spec §13.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   *
   * @returns JWT access token + refresh token pair
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Registration successful',
      data: tokens,
    };
  }

  /**
   * Login with email + password.
   *
   * @returns JWT access token + refresh token pair
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      data: tokens,
    };
  }

  /**
   * Refresh token rotation.
   * Accepts the current refresh token and returns a new pair.
   * The old refresh token is immediately invalidated.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return {
      statusCode: HttpStatus.OK,
      message: 'Tokens refreshed',
      data: tokens,
    };
  }
}
