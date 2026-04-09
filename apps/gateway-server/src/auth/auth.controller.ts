import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, LoginDto, RefreshTokenDto, RegisterDto, VerifyOtpDto, ForgotPasswordDto, ResetPasswordDto, SocialLoginDto, ResendOtpDto } from './auth.dto';
import { Headers, Ip } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-device-id') deviceId?: string,
    @Ip() ipAddress?: string,
  ) {
    const result = await this.authService.register(dto, deviceId, ipAddress);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Registration initiated. Please verify your OTP to complete registration.',
      data: result,
    };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @Headers('x-device-id') deviceId?: string,
    @Ip() ipAddress?: string,
  ) {
    const result = await this.authService.resendOtp(dto.email, deviceId, ipAddress);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-device-id') deviceId?: string,
    @Ip() ipAddress?: string,
  ) {
    const result = await this.authService.verifyOtp(dto, deviceId, ipAddress);
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      statusCode: HttpStatus.OK,
      message: 'Email verified successfully',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      data: result,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('x-device-id') deviceId?: string,
    @Ip() ipAddress?: string,
  ) {
    await this.authService.forgotPassword(dto, deviceId, ipAddress);
    return {
      statusCode: HttpStatus.OK,
      message: 'If the email exists, an OTP has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    await this.authService.resetPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Password has been successfully reset.',
    };
  }

  @Post('social/google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() dto: SocialLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.socialLogin(dto, 'google');
    this.setRefreshTokenCookie(response, result.refreshToken);
    return {
      statusCode: HttpStatus.OK,
      message: 'Google login successful',
      data: result,
    };
  }

  @Post('social/apple')
  @HttpCode(HttpStatus.OK)
  async appleLogin(
    @Body() dto: SocialLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.socialLogin(dto, 'apple');
    this.setRefreshTokenCookie(response, result.refreshToken);
    return {
      statusCode: HttpStatus.OK,
      message: 'Apple login successful',
      data: result,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken || this.getRefreshTokenFromCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshTokens(refreshToken);
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      statusCode: HttpStatus.OK,
      message: 'Tokens refreshed',
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() request: Request & { user: JwtPayload }) {
    const user = await this.authService.getCurrentUser(request.user.sub);
    return {
      statusCode: HttpStatus.OK,
      message: 'Current user loaded',
      data: user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request & { user: JwtPayload },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.user.sub);
    this.clearRefreshTokenCookie(response);

    return {
      statusCode: HttpStatus.OK,
      message: 'Logout successful',
    };
  }

  private getRefreshTokenFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((part) => part.trim());
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.split('=');
      if (name === 'refresh_token') {
        return decodeURIComponent(rest.join('='));
      }
    }

    return null;
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    response.cookie('refresh_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 0,
    });
  }
}
