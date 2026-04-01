import { Controller, Post, UseGuards, Body, Req, HttpCode, HttpStatus, Version, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from './storage.service';
import { JwtPayload } from '../auth/auth.dto';
import { IsEnum, IsString, IsNotEmpty, IsNumber, Max } from 'class-validator';

export class PresignedUrlRequestDto {
  @IsEnum(['avatars', 'recordings'])
  folder!: 'avatars' | 'recordings';

  @IsString()
  @IsNotEmpty()
  extension!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presigned-url')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: PresignedUrlRequestDto,
  ) {
    const { folder, extension, contentType } = dto;
    const maxSize = folder === 'avatars' ? 5 : 20; // 5MB for images, 20MB for recordings

    // Strict MIME typing validation
    const validImageMime = ['image/jpeg', 'image/png', 'image/webp'];
    const validAudioMime = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];

    if (folder === 'avatars' && !validImageMime.includes(contentType)) {
      throw new BadRequestException(`Invalid image content type: ${contentType}. Allowed: ${validImageMime.join(', ')}`);
    }

    if (folder === 'recordings' && !validAudioMime.includes(contentType)) {
      throw new BadRequestException(`Invalid audio content type: ${contentType}. Allowed: ${validAudioMime.join(', ')}`);
    }

    const result = await this.storageService.getPresignedUploadUrl(
      request.user.sub,
      folder,
      extension,
      contentType,
      maxSize,
    );

    return {
      message: 'Generated presigned POST policy successfully (expires in 60s)',
      uploadUrl: result.uploadUrl,
      fields: result.fields,
      key: result.key,
      publicUrl: this.storageService.getPublicUrl(result.key),
      maxSizeMb: maxSize,
    };
  }
}
