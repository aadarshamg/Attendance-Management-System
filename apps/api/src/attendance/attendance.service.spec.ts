import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import type { AppConfig } from '../config';
import type { RequestUser } from '../auth/jwt.types';
import type { MarkDto } from './mark.dto';

const config = {
  geofenceAccuracyThresholdM: 100,
  timeDriftThresholdSeconds: 300,
} as AppConfig;

const worker: RequestUser = {
  id: 'w1',
  role: 'worker',
  assignedSiteId: 'site_x',
  name: 'R. Kumar',
  employeeCode: 'W10482',
};

const file = { buffer: Buffer.from('img'), mimetype: 'image/webp', size: 1234 } as Express.Multer.File;

function baseDto(overrides: Partial<MarkDto> = {}): MarkDto {
  return {
    markType: 'check_in',
    latitude: 28.6274,
    longitude: 77.3716,
    gpsAccuracyM: 8,
    deviceTimestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeService(opts: { consented?: boolean; withinGeofence?: boolean }) {
  const created = {
    id: 'rec1',
    workerId: 'w1',
    siteId: 'site_x',
    markType: 'check_in',
    serverTimestamp: new Date(),
    deviceTimestamp: new Date(),
    latitude: 28.6274,
    longitude: 77.3716,
    gpsAccuracyM: 8,
    address: '62, Noida',
    withinGeofence: opts.withinGeofence ?? true,
    status: 'ok',
    flagReasons: [] as string[],
    imageStatus: 'stored',
    imageObjectKey: null,
    manualNote: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    worker: { id: 'w1', name: 'R. Kumar', employeeCode: 'W10482' },
    site: { id: 'site_x', name: 'Tower-B' },
    reviewedBy: null,
  };
  const create = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    created.status = data.status as string;
    created.flagReasons = data.flagReasons as string[];
    return Promise.resolve(created);
  });
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ consentedAt: opts.consented === false ? null : new Date() }),
    },
    attendanceRecord: { create, update: jest.fn().mockResolvedValue(created) },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const geofence = { isWithinSiteGeofence: jest.fn().mockResolvedValue(opts.withinGeofence ?? true) };
  const geocode = { reverseGeocode: jest.fn().mockResolvedValue('62, Noida') };
  const images = {
    normalize: jest.fn().mockResolvedValue(Buffer.from('canon')),
    objectKey: jest.fn().mockReturnValue('attendance/2026/09/rec1.webp'),
    upload: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new AttendanceService(
    prisma as never,
    audit as never,
    geofence as never,
    geocode as never,
    images as never,
    config,
  );
  return { svc, create, images, audit };
}

describe('AttendanceService.mark', () => {
  it('blocks a worker who has not consented', async () => {
    const { svc } = makeService({ consented: false });
    await expect(svc.mark(worker, baseDto(), file)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records an ok mark inside the geofence with good accuracy', async () => {
    const { svc, images, audit } = makeService({ withinGeofence: true });
    const res = await svc.mark(worker, baseDto(), file);
    expect(res.status).toBe('ok');
    expect(res.flagReasons).toEqual([]);
    expect(images.upload).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attendance.mark' }),
    );
  });

  it('flags a mark outside the geofence', async () => {
    const { svc } = makeService({ withinGeofence: false });
    const res = await svc.mark(worker, baseDto(), file);
    expect(res.status).toBe('flagged');
    expect(res.flagReasons).toContain('outside_geofence');
  });

  it('flags poor GPS accuracy even when inside the geofence', async () => {
    const { svc } = makeService({ withinGeofence: true });
    const res = await svc.mark(worker, baseDto({ gpsAccuracyM: 250 }), file);
    expect(res.status).toBe('flagged');
    expect(res.flagReasons).toContain('low_gps_accuracy');
  });
});
