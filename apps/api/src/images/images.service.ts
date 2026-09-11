import { Inject, Injectable, Logger, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { ACCEPTED_IMAGE_MIME } from '@ams/shared';
import { APP_CONFIG, AppConfig } from '../config';

const MAX_EDGE = 1280;
const WEBP_QUALITY = 65;

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  private readonly s3: S3Client;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.s3 = new S3Client({
      region: config.storage.region,
      endpoint: config.storage.endpoint,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }

  /**
   * Server-side safeguard: reject anything that is not a small webp/jpeg, then
   * re-encode to a canonical WebP so a tampered or oversized upload cannot bloat
   * storage. Returns the bytes to persist.
   */
  async normalize(file: Express.Multer.File): Promise<Buffer> {
    if (!ACCEPTED_IMAGE_MIME.includes(file.mimetype as (typeof ACCEPTED_IMAGE_MIME)[number])) {
      throw new UnsupportedMediaTypeException('Only camera JPEG/WebP is accepted');
    }
    if (file.size > this.config.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `Image exceeds ${this.config.maxUploadBytes} bytes; compress harder on the device`,
      );
    }
    return sharp(file.buffer)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  }

  objectKey(recordId: string, when: Date): string {
    const yyyy = when.getUTCFullYear();
    const mm = String(when.getUTCMonth() + 1).padStart(2, '0');
    return `attendance/${yyyy}/${mm}/${recordId}.webp`;
  }

  async upload(key: string, body: Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.storage.bucket,
        Key: key,
        Body: body,
        ContentType: 'image/webp',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
    );
  }

  async signedGetUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
      { expiresIn: this.config.signedUrlTtlSeconds },
    );
  }
}
