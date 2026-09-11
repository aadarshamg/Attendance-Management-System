import { RetentionService } from './retention.service';
import type { AppConfig } from '../config';

describe('RetentionService.purgeOlderThan', () => {
  const config = { imageRetentionDays: 90 } as AppConfig;

  function setup(records: { id: string; imageObjectKey: string | null }[]) {
    const remaining = [...records];
    const updated: string[] = [];
    const deleted: string[] = [];

    const prisma = {
      attendanceRecord: {
        findMany: jest.fn(async () => {
          const batch = remaining.splice(0, remaining.length);
          return batch;
        }),
        update: jest.fn(async ({ where }: { where: { id: string } }) => {
          updated.push(where.id);
        }),
      },
    };
    const images = { delete: jest.fn(async (key: string) => void deleted.push(key)) };
    const audit = { record: jest.fn(async () => undefined) };

    const svc = new RetentionService(
      prisma as never,
      audit as never,
      images as never,
      config,
    );
    return { svc, updated, deleted, images };
  }

  it('purges old stored images and marks them purged', async () => {
    const { svc, updated, deleted } = setup([
      { id: 'r1', imageObjectKey: 'attendance/2024/01/r1.webp' },
      { id: 'r2', imageObjectKey: 'attendance/2024/01/r2.webp' },
    ]);
    const res = await svc.purgeOlderThan(90);
    expect(res).toEqual({ scanned: 2, purged: 2, errors: 0 });
    expect(deleted).toHaveLength(2);
    expect(updated.sort()).toEqual(['r1', 'r2']);
  });

  it('is a no-op when nothing is old enough', async () => {
    const { svc, deleted } = setup([]);
    const res = await svc.purgeOlderThan(90);
    expect(res).toEqual({ scanned: 0, purged: 0, errors: 0 });
    expect(deleted).toHaveLength(0);
  });

  it('counts an error but keeps going when storage delete fails', async () => {
    const { svc, images } = setup([{ id: 'r1', imageObjectKey: 'k1' }]);
    (images.delete as jest.Mock).mockRejectedValueOnce(new Error('S3 down'));
    const res = await svc.purgeOlderThan(90);
    expect(res.errors).toBe(1);
    expect(res.purged).toBe(0);
  });
});
