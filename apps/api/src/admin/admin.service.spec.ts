import { ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import type { RequestUser } from '../auth/jwt.types';
import type { AdminRecordQuery } from '@ams/shared';

const admin: RequestUser = {
  id: 'a1',
  role: 'admin',
  assignedSiteId: null,
  name: 'Admin',
  employeeCode: 'ADMIN001',
};
const supervisor: RequestUser = {
  id: 's1',
  role: 'supervisor',
  assignedSiteId: 'site_x',
  name: 'Sup',
  employeeCode: 'SUP001',
};
const q: AdminRecordQuery = { page: 1, limit: 25, siteId: 'site_other' };

function makeService() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = { attendanceRecord: { findMany, count } };
  const svc = new AdminService(prisma as never, {} as never, {} as never);
  return { svc, findMany };
}

describe('AdminService site scoping', () => {
  it('admin can filter by any site', async () => {
    const { svc, findMany } = makeService();
    await svc.listRecords(admin, q);
    expect(findMany.mock.calls[0][0].where.siteId).toBe('site_other');
  });

  it('supervisor is forced to their own site regardless of the query', async () => {
    const { svc, findMany } = makeService();
    await svc.listRecords(supervisor, q);
    expect(findMany.mock.calls[0][0].where.siteId).toBe('site_x');
  });

  it('supervisor with no assigned site is denied', async () => {
    const { svc } = makeService();
    await expect(
      svc.listRecords({ ...supervisor, assignedSiteId: null }, q),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AdminService.getRecord scoping', () => {
  function withRecord(siteId: string | null) {
    const prisma = {
      attendanceRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1',
          siteId,
          workerId: 'w1',
          markType: 'check_in',
          serverTimestamp: new Date(),
          deviceTimestamp: new Date(),
          latitude: 1,
          longitude: 2,
          gpsAccuracyM: 5,
          address: null,
          withinGeofence: true,
          status: 'ok',
          flagReasons: [],
          imageStatus: 'purged',
          imageObjectKey: null,
          manualNote: null,
          reviewedById: null,
          reviewedAt: null,
          createdAt: new Date(),
          worker: { id: 'w1', name: 'W', employeeCode: 'W1' },
          site: null,
          reviewedBy: null,
        }),
      },
    };
    return new AdminService(prisma as never, { signedGetUrl: jest.fn() } as never, {} as never);
  }

  it('rejects a supervisor opening a record outside their site', async () => {
    const svc = withRecord('site_y');
    await expect(svc.getRecord(supervisor, 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a supervisor to open a record on their site', async () => {
    const svc = withRecord('site_x');
    await expect(svc.getRecord(supervisor, 'r1')).resolves.toMatchObject({ id: 'r1' });
  });
});
