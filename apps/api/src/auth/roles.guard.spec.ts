import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { Role } from '@ams/shared';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const make = (required: Role[] | undefined) => {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('allows when no roles are required', () => {
    expect(make(undefined).canActivate(ctx({ role: 'worker' }))).toBe(true);
  });

  it('allows a matching role', () => {
    expect(make(['admin']).canActivate(ctx({ role: 'admin' }))).toBe(true);
  });

  it('rejects a worker hitting an admin route', () => {
    expect(() => make(['admin']).canActivate(ctx({ role: 'worker' }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no user', () => {
    expect(() => make(['worker']).canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
