import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { normalizePhone, type AuthUser, type LoginResponse } from '@ams/shared';
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
  sessionVersion: number;
  assignedSite: { name: string } | null;
};

/** A 4-digit PIN has only 10,000 values, so lock the account briefly after a few misses. */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

// Compared against when no account matches, so a miss costs the same time as a wrong PIN.
const DUMMY_HASH = bcrypt.hashSync('0000', 10);

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
  private readonly logger = new Logger(AuthService.name);

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
    return this.issueSession(user, 'password');
  }

  /** Workers' simple login: 10-digit mobile number + 4-digit PIN. */
  async pinLogin(rawPhone: string, pin: string): Promise<LoginResponse> {
    const phone = normalizePhone(rawPhone);
    const matches = phone
      ? await this.prisma.user.findMany({
          where: { phone, role: 'worker', isActive: true, pinHash: { not: null } },
          take: 2,
          ...userWithSite,
        })
      : [];
    if (matches.length > 1) {
      // Admin-side checks prevent this; refuse rather than guess which worker it is.
      this.logger.warn(`PIN login refused: phone ${phone} is shared by several workers`);
    }
    const user = matches.length === 1 ? matches[0] : null;
    if (!user) {
      await bcrypt.compare(pin, DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      throw new HttpException('PIN_LOCKED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await bcrypt.compare(pin, user.pinHash!))) {
      const { pinFailedAttempts } = await this.prisma.user.update({
        where: { id: user.id },
        data: { pinFailedAttempts: { increment: 1 } },
        select: { pinFailedAttempts: true },
      });
      if (pinFailedAttempts >= PIN_MAX_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            pinFailedAttempts: 0,
            pinLockedUntil: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000),
          },
        });
        await this.audit.record({
          actorId: user.id,
          action: 'auth.pin_locked',
          targetType: 'user',
          targetId: user.id,
        });
        throw new HttpException('PIN_LOCKED', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.pinFailedAttempts > 0 || user.pinLockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { pinFailedAttempts: 0, pinLockedUntil: null },
      });
    }
    return this.issueSession(user, 'pin');
  }

  private async issueSession(user: DbUserWithSite, method: 'password' | 'pin'): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      assignedSiteId: user.assignedSiteId,
      name: user.name,
      employeeCode: user.employeeCode,
      sv: user.sessionVersion,
    };
    const ttl = user.role === 'worker' ? this.config.workerJwtTtl : this.config.jwtTtl;
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.jwtSecret,
      // ttl is a duration string like "12h"; jsonwebtoken's types want its own StringValue union.
      expiresIn: ttl as unknown as number,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      details: { method },
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
