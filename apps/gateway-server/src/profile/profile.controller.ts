import { Controller, Patch, UseGuards, Body, Req, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './profile.dto';
import { JwtPayload } from '../auth/auth.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch('me')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.profileService.updateProfile(request.user.sub, dto);
    return {
      message: 'Profile updated successfully',
      data: updated,
    };
  }
}
