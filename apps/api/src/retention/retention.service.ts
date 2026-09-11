import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImagesService } from '../images/images.service';

export interface PurgeResult {
  scanned: number;
  purged: number;
  errors: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly images: ImagesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'image-retention-purge' })
  async scheduledPurge(): Promise<void> {
    const result = await this.purgeOlderThan(this.config.imageRetentionDays);
    this.logger.log(
      `Retention purge: scanned=${result.scanned} purged=${result.purged} errors=${result.errors}`,
    );
  }

  /**
   * Delete image binaries for records whose serverTimestamp is older than
   * `days`, then set imageStatus='purged'. Text columns are never touched.
   * Idempotent: records already 'purged' are skipped.
   */
  async purgeOlderThan(days: number, batchSize = 500): Promise<PurgeResult> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result: PurgeResult = { scanned: 0, purged: 0, errors: 0 };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.prisma.attendanceRecord.findMany({
        where: { imageStatus: 'stored', serverTimestamp: { lt: cutoff } },
        select: { id: true, imageObjectKey: true },
        take: batchSize,
      });
      if (batch.length === 0) break;

      for (const rec of batch) {
        result.scanned += 1;
        try {
          if (rec.imageObjectKey) {
            await this.images.delete(rec.imageObjectKey);
          }
          await this.prisma.attendanceRecord.update({
            where: { id: rec.id },
            data: { imageStatus: 'purged' },
          });
          await this.audit.record({
            action: 'image.purged',
            targetType: 'attendance_record',
            targetId: rec.id,
            details: { objectKey: rec.imageObjectKey, cutoff: cutoff.toISOString() },
          });
          result.purged += 1;
        } catch (err) {
          result.errors += 1;
          this.logger.error(`Failed to purge image for record ${rec.id}`, err as Error);
        }
      }

      if (batch.length < batchSize) break;
    }
    return result;
  }
}
