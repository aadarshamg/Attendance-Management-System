import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Role, UserSummary } from '@ams/shared';
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
  };
}

const include = { assignedSite: { select: { name: true } } } as const;

interface CreateInput {
  name: string;
  role: Role;
  employeeCode: string;
  phone?: string;
  assignedSiteId?: string | null;
  password: string;
}

interface UpdateInput {
  name?: string;
  role?: Role;
  phone?: string | null;
  assignedSiteId?: string | null;
  isActive?: boolean;
  password?: string;
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

  async create(actorId: string, input: CreateInput): Promise<UserSummary> {
    const dupe = await this.prisma.user.findUnique({ where: { employeeCode: input.employeeCode } });
    if (dupe) throw new ConflictException('employeeCode already in use');
    if (input.assignedSiteId) await this.assertSiteExists(input.assignedSiteId);
    if (input.role === 'worker' && !input.assignedSiteId) {
      throw new BadRequestException('Workers must be assigned to a site');
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        role: input.role,
        employeeCode: input.employeeCode,
        phone: input.phone ?? null,
        assignedSiteId: input.assignedSiteId ?? null,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
      include,
    });
    await this.audit.record({
      actorId,
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      details: { role: user.role, employeeCode: user.employeeCode },
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

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        phone: input.phone,
        assignedSiteId: input.assignedSiteId,
        isActive: input.isActive,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
      },
      include,
    });
    await this.audit.record({
      actorId,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      details: {
        fields: Object.keys(input).filter((k) => k !== 'password'),
        passwordReset: Boolean(input.password),
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
      data: { isActive: false },
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
