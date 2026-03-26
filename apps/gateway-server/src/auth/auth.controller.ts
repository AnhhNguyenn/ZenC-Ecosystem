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
import { JwtPayload, LoginDto, RefreshTokenDto, RegisterDto } from './auth.dto';

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
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Registration successful',
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
