import { Controller, Get, Version } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @Version('1')
  getAppVersion() {
    return {
      currentVersion: this.config.get('APP_VERSION', '1.0.0'),
      minimumRequiredVersion: this.config.get('MIN_APP_VERSION', '1.0.0'),
      forceUpdateUrl: this.config.get('APP_UPDATE_URL', 'https://zenc.ai/download'),
      message: "Please update your app to continue."
    };
  }
}
