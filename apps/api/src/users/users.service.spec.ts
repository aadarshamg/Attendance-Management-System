import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

function makeService(overrides: {
  findUnique?: jest.Mock;
  findFirst?: jest.Mock;
  siteFindUnique?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
}) {
  const prisma = {
    user: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
      findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
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
      pinHash: null,
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

describe('UsersService PIN rules', () => {
  const base = { name: 'W', role: 'worker' as const, employeeCode: 'W9', assignedSiteId: 'site_x' };

  it('creates a PIN-only worker with a normalised phone and no usable password', async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      ...data,
      id: 'u9',
      isActive: true,
      consentedAt: null,
      assignedSite: { name: 'Site' },
    }));
    const { svc } = makeService({ create });
    const res = await svc.create('admin', { ...base, phone: '+91 98765 43210', pin: '4321' });
    const data = create.mock.calls[0][0].data;
    expect(data.phone).toBe('9876543210');
    expect(data.pinHash).toEqual(expect.any(String));
    expect(data.passwordHash).toEqual(expect.any(String));
    expect(res.hasPin).toBe(true);
  });

  it('requires a phone when a PIN is set', async () => {
    const { svc } = makeService({});
    await expect(svc.create('admin', { ...base, pin: '4321' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires a PIN or password', async () => {
    const { svc } = makeService({});
    await expect(svc.create('admin', { ...base, phone: '9876543210' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a PIN for staff', async () => {
    const { svc } = makeService({});
    await expect(
      svc.create('admin', { ...base, role: 'supervisor', phone: '9876543210', pin: '4321' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a phone already in use', async () => {
    const { svc } = makeService({ findFirst: jest.fn().mockResolvedValue({ id: 'other' }) });
    await expect(
      svc.create('admin', { ...base, phone: '9876543210', pin: '4321' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a phone that is not 10 digits', async () => {
    const { svc } = makeService({});
    await expect(
      svc.create('admin', { ...base, phone: '12345', pin: '4321' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs the worker out everywhere when the PIN is reset', async () => {
    const existing = { id: 'w1', role: 'worker', assignedSiteId: 'site_x', phone: '9876543210', pinHash: 'h' };
    const update = jest.fn().mockResolvedValue({ ...existing, name: 'W', employeeCode: 'W1', isActive: true, consentedAt: null, assignedSite: null });
    const { svc } = makeService({ findUnique: jest.fn().mockResolvedValue(existing), update });
    await svc.update('admin', 'w1', { pin: '5555' });
    expect(update.mock.calls[0][0].data).toMatchObject({
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      sessionVersion: { increment: 1 },
    });
  });
});

describe('UsersService.deactivate', () => {
  it('refuses to deactivate yourself', async () => {
    const { svc } = makeService({ findUnique: jest.fn().mockResolvedValue({ id: 'admin' }) });
    await expect(svc.deactivate('admin', 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
});
