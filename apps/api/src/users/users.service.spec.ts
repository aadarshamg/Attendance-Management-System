import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

function makeService(overrides: {
  findUnique?: jest.Mock;
  siteFindUnique?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
}) {
  const prisma = {
    user: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
      create: overrides.create ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
    site: {
      findUnique: overrides.siteFindUnique ?? jest.fn().mockResolvedValue({ id: 'site_x' }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { svc: new UsersService(prisma as never, audit as never), prisma };
}

describe('UsersService.create', () => {
  it('rejects a duplicate employee code', async () => {
    const { svc } = makeService({ findUnique: jest.fn().mockResolvedValue({ id: 'dupe' }) });
    await expect(
      svc.create('admin', {
        name: 'X',
        role: 'worker',
        employeeCode: 'W1',
        assignedSiteId: 'site_x',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a worker with no assigned site', async () => {
    const { svc } = makeService({});
    await expect(
      svc.create('admin', {
        name: 'X',
        role: 'worker',
        employeeCode: 'W2',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a supervisor without a site', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'u1',
      name: 'S',
      role: 'supervisor',
      employeeCode: 'S1',
      phone: null,
      assignedSiteId: null,
      isActive: true,
      consentedAt: null,
      assignedSite: null,
    });
    const { svc } = makeService({ create });
    await expect(
      svc.create('admin', {
        name: 'S',
        role: 'supervisor',
        employeeCode: 'S1',
        password: 'password123',
      }),
    ).resolves.toMatchObject({ id: 'u1', role: 'supervisor' });
    expect(create).toHaveBeenCalled();
  });
});

describe('UsersService.deactivate', () => {
  it('refuses to deactivate yourself', async () => {
    const { svc } = makeService({ findUnique: jest.fn().mockResolvedValue({ id: 'admin' }) });
    await expect(svc.deactivate('admin', 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
});
