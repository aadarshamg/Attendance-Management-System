import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { normalizePhone, type Role, type UserSummary } from '@ams/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type DbUser = {
  id: string;
  name: string;
  role: Role;
  employeeCode: string;
  phone: string | null;
  assignedSiteId: string | null;
  isActive: boolean;
  consentedAt: Date | null;
  pinHash: string | null;
  assignedSite: { name: string } | null;
};

function toSummary(u: DbUser): UserSummary {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    employeeCode: u.employeeCode,
    phone: u.phone,
    assignedSiteId: u.assignedSiteId,
    assignedSiteName: u.assignedSite?.name ?? null,
    isActive: u.isActive,
    consentedAt: u.consentedAt ? u.consentedAt.toISOString() : null,
    hasPin: Boolean(u.pinHash),
  };
}

const include = { assignedSite: { select: { name: true } } } as const;

interface CreateInput {
  name: string;
  role: Role;
  employeeCode: string;
  phone?: string;
  assignedSiteId?: string | null;
  password?: string;
  pin?: string;
}

interface UpdateInput {
  name?: string;
  role?: Role;
  phone?: string | null;
  assignedSiteId?: string | null;
  isActive?: boolean;
  password?: string;
  pin?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({ orderBy: { name: 'asc' }, include });
    return users.map(toSummary);
  }

  private async assertSiteExists(siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new BadRequestException('assignedSiteId does not exist');
  }

  /** Normalises a phone to its 10 digits (null when blank) and rejects one another user already has. */
  private async checkPhone(raw: string | null | undefined, selfId?: string): Promise<string | null> {
    if (!raw?.trim()) return null;
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException('Phone must be a 10-digit mobile number');
    const taken = await this.prisma.user.findFirst({
      where: { phone, ...(selfId ? { id: { not: selfId } } : {}) },
      select: { id: true },
    });
    if (taken) throw new ConflictException('This phone number is already used by another user');
    return phone;
  }

  async create(actorId: string, input: CreateInput): Promise<UserSummary> {
    const dupe = await this.prisma.user.findUnique({ where: { employeeCode: input.employeeCode } });
    if (dupe) throw new ConflictException('employeeCode already in use');
    if (input.assignedSiteId) await this.assertSiteExists(input.assignedSiteId);
    if (input.role === 'worker' && !input.assignedSiteId) {
      throw new BadRequestException('Workers must be assigned to a site');
    }
    if (input.pin && input.role !== 'worker') {
      throw new BadRequestException('Only workers can have a PIN');
    }
    if (!input.password && !input.pin) {
      throw new BadRequestException(
        input.role === 'worker' ? 'Set a PIN or a password' : 'A password is required',
      );
    }
    const phone = await this.checkPhone(input.phone);
    if (input.pin && !phone) {
      throw new BadRequestException('A phone number is required for PIN login');
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        role: input.role,
        employeeCode: input.employeeCode,
        phone,
        assignedSiteId: input.assignedSiteId ?? null,
        // PIN-only workers get an unguessable password so employee-code login stays closed.
        passwordHash: await bcrypt.hash(input.password ?? randomBytes(32).toString('hex'), 10),
        pinHash: input.pin ? await bcrypt.hash(input.pin, 10) : null,
      },
      include,
    });
    await this.audit.record({
      actorId,
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      details: { role: user.role, employeeCode: user.employeeCode, pinSet: Boolean(input.pin) },
    });
    return toSummary(user);
  }

  async update(actorId: string, id: string, input: UpdateInput): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (input.assignedSiteId) await this.assertSiteExists(input.assignedSiteId);

    const nextRole = input.role ?? existing.role;
    const nextSite =
      input.assignedSiteId !== undefined ? input.assignedSiteId : existing.assignedSiteId;
    if (nextRole === 'worker' && !nextSite) {
      throw new BadRequestException('Workers must be assigned to a site');
    }
    if (input.pin && nextRole !== 'worker') {
      throw new BadRequestException('Only workers can have a PIN');
    }
    const phone =
      input.phone !== undefined ? await this.checkPhone(input.phone, id) : existing.phone;
    // A worker promoted to staff loses the PIN: staff must use their password.
    const keepsPin = nextRole === 'worker' && Boolean(input.pin || existing.pinHash);
    if (keepsPin && !phone) {
      throw new BadRequestException('A phone number is required for PIN login');
    }

    // Any credential reset or deactivation signs the user out of every device.
    const revokeSessions = Boolean(input.password || input.pin) || input.isActive === false;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        phone: input.phone !== undefined ? phone : undefined,
        assignedSiteId: input.assignedSiteId,
        isActive: input.isActive,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
        ...(input.pin
          ? { pinHash: await bcrypt.hash(input.pin, 10), pinFailedAttempts: 0, pinLockedUntil: null }
          : {}),
        ...(!keepsPin && existing.pinHash ? { pinHash: null } : {}),
        ...(revokeSessions ? { sessionVersion: { increment: 1 } } : {}),
      },
      include,
    });
    await this.audit.record({
      actorId,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      details: {
        fields: Object.keys(input).filter((k) => k !== 'password' && k !== 'pin'),
        passwordReset: Boolean(input.password),
        pinReset: Boolean(input.pin),
      },
    });
    return toSummary(user);
  }

  /** Users are deactivated, never deleted — they own permanent attendance records. */
  async deactivate(actorId: string, id: string): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.id === actorId) throw new BadRequestException('You cannot deactivate yourself');
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false, sessionVersion: { increment: 1 } },
      include,
    });
    await this.audit.record({
      actorId,
      action: 'user.deactivate',
      targetType: 'user',
      targetId: id,
    });
    return toSummary(user);
  }
}
