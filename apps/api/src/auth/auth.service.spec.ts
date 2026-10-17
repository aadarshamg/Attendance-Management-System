import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService, PIN_MAX_ATTEMPTS } from './auth.service';

const PIN_HASH = bcrypt.hashSync('4321', 4);

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    name: 'R. Kumar',
    role: 'worker',
    employeeCode: 'W1',
    phone: '9876543210',
    assignedSiteId: 'site_1',
    consentedAt: null,
    sessionVersion: 3,
    pinHash: PIN_HASH,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    assignedSite: { name: 'Tower-B' },
    ...overrides,
  };
}

function makeService(found: unknown[], failedAfterIncrement = 1) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(found),
      update: jest.fn().mockResolvedValue({ pinFailedAttempts: failedAfterIncrement }),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { jwtSecret: 's', jwtTtl: '12h', workerJwtTtl: '90d' };
  const svc = new AuthService(prisma as never, jwt as never, audit as never, config as never);
  return { svc, prisma, jwt };
}

describe('AuthService.pinLogin', () => {
  it('signs a worker in with phone + PIN and issues a long-lived token', async () => {
    const { svc, prisma, jwt } = makeService([worker()]);
    const res = await svc.pinLogin('+91 98765-43210', '4321');
    expect(res.user).toMatchObject({ id: 'w1', assignedSiteName: 'Tower-B' });
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      phone: '9876543210',
      role: 'worker',
      isActive: true,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'w1', sv: 3 }),
      expect.objectContaining({ expiresIn: '90d' }),
    );
  });

  it('rejects an unknown phone', async () => {
    const { svc } = makeService([]);
    await expect(svc.pinLogin('9000000000', '1234')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a phone shared by two workers', async () => {
    const { svc } = makeService([worker(), worker({ id: 'w2' })]);
    await expect(svc.pinLogin('9876543210', '4321')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('counts a wrong PIN', async () => {
    const { svc, prisma } = makeService([worker()]);
    await expect(svc.pinLogin('9876543210', '0000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pinFailedAttempts: { increment: 1 } } }),
    );
  });

  it('locks the account after too many wrong PINs', async () => {
    const { svc, prisma } = makeService([worker()], PIN_MAX_ATTEMPTS);
    const err = await svc.pinLogin('9876543210', '0000').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.message).toBe('PIN_LOCKED');
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pinFailedAttempts: 0, pinLockedUntil: expect.any(Date) }),
      }),
    );
  });

  it('refuses even the right PIN while locked', async () => {
    const { svc } = makeService([worker({ pinLockedUntil: new Date(Date.now() + 60_000) })]);
    const err = await svc.pinLogin('9876543210', '4321').catch((e) => e);
    expect(err.message).toBe('PIN_LOCKED');
  });

  it('clears the failure count after a successful login', async () => {
    const { svc, prisma } = makeService([worker({ pinFailedAttempts: 2 })]);
    await svc.pinLogin('9876543210', '4321');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pinFailedAttempts: 0, pinLockedUntil: null } }),
    );
  });
});
