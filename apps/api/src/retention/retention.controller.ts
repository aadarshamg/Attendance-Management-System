import { Controller, Get, Headers, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { RetentionService } from './retention.service';

/**
 * HTTP-triggered equivalent of the in-process @Cron in retention.service.ts —
 * needed on serverless hosts (e.g. Vercel), which have no persistent process to
 * hold a timer. Configure a Vercel Cron Job (see vercel.json) to GET this path
 * daily; Vercel automatically sends `Authorization: Bearer $CRON_SECRET`.
 *
 * On a persistent host (Docker, `npm run dev`) the existing @Cron already
 * covers this — this endpoint is simply unused there, which is harmless.
 */
@Controller('internal/retention')
export class RetentionController {
  private readonly logger = new Logger(RetentionController.name);

  constructor(
    private readonly retention: RetentionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('purge')
  async purge(@Headers('authorization') authorization?: string) {
    const secret = this.config.cronSecret;
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    const result = await this.retention.purgeOlderThan(this.config.imageRetentionDays);
    this.logger.log(
      `HTTP-triggered retention purge: scanned=${result.scanned} purged=${result.purged} errors=${result.errors}`,
    );
    return result;
  }
}
