import { UnauthorizedException } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import type { AppConfig } from '../config';

describe('RetentionController.purge (Vercel Cron trigger)', () => {
  const config = { imageRetentionDays: 90 } as AppConfig;
  const retention = { purgeOlderThan: jest.fn().mockResolvedValue({ scanned: 0, purged: 0, errors: 0 }) };
  const controller = new RetentionController(retention as never, config);

  const originalSecret = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    retention.purgeOlderThan.mockClear();
  });

  it('rejects when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.purge('Bearer anything')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a missing or wrong bearer token', async () => {
    process.env.CRON_SECRET = 'topsecret';
    await expect(controller.purge(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.purge('Bearer wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('runs the purge when the bearer token matches (Vercel Cron convention)', async () => {
    process.env.CRON_SECRET = 'topsecret';
    await controller.purge('Bearer topsecret');
    expect(retention.purgeOlderThan).toHaveBeenCalledWith(90);
  });
});
