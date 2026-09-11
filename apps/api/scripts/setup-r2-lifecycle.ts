/**
 * Defense-in-depth: configure the object-storage bucket to auto-expire images a
 * few days after the app-level 90-day purge, so a missed cron run still can't
 * keep binaries forever. The DB record is untouched by this rule.
 *
 *   npm run setup:r2-lifecycle
 *
 * Optional. Providers that don't implement S3 bucket lifecycle (e.g. Supabase
 * Storage) will report "not supported" — that's fine, the daily purge cron in
 * the API still enforces IMAGE_RETENTION_DAYS.
 */
import 'reflect-metadata';
import { PutBucketLifecycleConfigurationCommand, S3Client } from '@aws-sdk/client-s3';
import { loadConfig } from '../src/config';

async function main() {
  const cfg = loadConfig();
  const s3 = new S3Client({
    region: cfg.storage.region,
    endpoint: cfg.storage.endpoint,
    forcePathStyle: cfg.storage.forcePathStyle,
    credentials: {
      accessKeyId: cfg.storage.accessKeyId,
      secretAccessKey: cfg.storage.secretAccessKey,
    },
  });

  const expireDays = cfg.imageRetentionDays + 5;
  try {
    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: cfg.storage.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: `expire-attendance-images-${expireDays}d`,
              Status: 'Enabled',
              Filter: { Prefix: 'attendance/' },
              Expiration: { Days: expireDays },
            },
          ],
        },
      }),
    );
    // eslint-disable-next-line no-console
    console.log(
      `Lifecycle rule set on ${cfg.storage.bucket}: attendance/* expires after ${expireDays} days.`,
    );
  } catch (err) {
    const name = (err as { name?: string }).name ?? '';
    if (/NotImplemented|MethodNotAllowed|501|405/.test(name) || /NotImplemented/.test(String(err))) {
      // eslint-disable-next-line no-console
      console.warn(
        `This storage provider does not support S3 bucket lifecycle rules — skipping. ` +
          `The API's daily retention cron still purges images after ${cfg.imageRetentionDays} days.`,
      );
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
