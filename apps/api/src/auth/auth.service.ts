import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthUser, LoginResponse } from '@ams/shared';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from './jwt.types';

const userWithSite = {
  include: { assignedSite: { select: { name: true } } },
} as const;

type DbUserWithSite = {
  id: string;
  name: string;
  role: AuthUser['role'];
  employeeCode: string;
  assignedSiteId: string | null;
  consentedAt: Date | null;
  assignedSite: { name: string } | null;
};

function toAuthUser(u: DbUserWithSite): AuthUser {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    employeeCode: u.employeeCode,
    assignedSiteId: u.assignedSiteId,
    assignedSiteName: u.assignedSite?.name ?? null,
    consentedAt: u.consentedAt ? u.consentedAt.toISOString() : null,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(employeeCode: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { employeeCode }, ...userWithSite });
    const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      assignedSiteId: user.assignedSiteId,
      name: user.name,
      employeeCode: user.employeeCode,
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.jwtSecret,
      // jwtTtl is a duration string like "12h"; jsonwebtoken's types want its own StringValue union.
      expiresIn: this.config.jwtTtl as unknown as number,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
    });

    return { token, user: toAuthUser(user) };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, ...userWithSite });
    if (!user) throw new NotFoundException('User not found');
    return toAuthUser(user);
  }

  async giveConsent(userId: string): Promise<{ consentedAt: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    const consentedAt = existing?.consentedAt ?? new Date();
    if (!existing?.consentedAt) {
      await this.prisma.user.update({ where: { id: userId }, data: { consentedAt } });
      await this.audit.record({
        actorId: userId,
        action: 'consent.given',
        targetType: 'user',
        targetId: userId,
      });
    }
    return { consentedAt: consentedAt.toISOString() };
  }
}
