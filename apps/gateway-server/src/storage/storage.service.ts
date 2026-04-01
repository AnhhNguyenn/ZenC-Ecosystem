import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('S3_REGION', 'ap-southeast-1');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucketName = this.config.get<string>('S3_BUCKET_NAME', 'zenc-media-bucket');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 credentials not found. Presigned URLs will fail.');
      this.s3Client = new S3Client({ region: 'mock-region' });
    } else {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: !!endpoint, // needed for MinIO
      });
    }
  }

  /**
   * Generates a pre-signed POST policy allowing the client to securely upload a file directly to S3
   * with strict content length ranges and exact content type matching.
   */
  async getPresignedUploadUrl(userId: string, folder: 'avatars' | 'recordings', extension: string, contentType: string, maxSizeMb: number): Promise<any> {
    try {
      const allowedContentTypes = ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/wav', 'audio/webm'];
      if (!allowedContentTypes.includes(contentType)) {
        throw new InternalServerErrorException('Invalid Content-Type for upload.');
      }

      const extMatch = extension.replace('.', '');
      const uuid = require('crypto').randomUUID();
      const key = `${folder}/${userId}/${Date.now()}-${uuid}.${extMatch}`;

      const { url, fields } = await createPresignedPost(this.s3Client, {
        Bucket: this.bucketName,
        Key: key,
        Conditions: [
          ['content-length-range', 0, maxSizeMb * 1024 * 1024],
          ['eq', '$Content-Type', contentType],
        ],
        Fields: {
          'Content-Type': contentType,
        },
        Expires: 60, // 60 seconds
      });

      this.logger.log(`Generated Presigned POST for ${userId} (${folder})`);

      return { uploadUrl: url, fields, key };
    } catch (e) {
      this.logger.error(`Failed to generate presigned url: ${e}`);
      throw new InternalServerErrorException('Could not generate upload URL.');
    }
  }

  /**
   * Returns the public CDN URL for a given object key
   */
  getPublicUrl(key: string): string {
    const cdnBase = this.config.get<string>('CDN_URL');
    if (cdnBase) {
      return `${cdnBase.replace(/\/$/, '')}/${key}`;
    }
    // Fallback if no CDN
    const endpoint = this.config.get<string>('S3_ENDPOINT', `https://${this.bucketName}.s3.amazonaws.com`);
    return `${endpoint.replace(/\/$/, '')}/${this.bucketName}/${key}`;
  }
}
