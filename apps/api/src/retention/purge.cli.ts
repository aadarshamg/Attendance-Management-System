/**
 * Manual retention purge — same routine the daily cron runs.
 *
 *   npm run purge:images -- --older-than 90
 *   npm run purge:images -- --older-than 0     # purge everything (testing)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RetentionService } from './retention.service';

function parseOlderThan(): number {
  const idx = process.argv.indexOf('--older-than');
  if (idx === -1) return Number(process.env.IMAGE_RETENTION_DAYS ?? 90);
  const val = Number(process.argv[idx + 1]);
  if (!Number.isFinite(val) || val < 0) {
    throw new Error('--older-than must be a non-negative number of days');
  }
  return val;
}

async function main() {
  const days = parseOlderThan();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const retention = app.get(RetentionService);
    const result = await retention.purgeOlderThan(days);
    Logger.log(
      `Purge complete (older than ${days}d): scanned=${result.scanned} purged=${result.purged} errors=${result.errors}`,
      'PurgeCLI',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
