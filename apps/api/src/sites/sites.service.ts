import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SiteInput, SiteSummary } from '@ams/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SiteSummary[]> {
    const sites = await this.prisma.site.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return sites.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      geofenceCenterLat: s.geofenceCenterLat,
      geofenceCenterLng: s.geofenceCenterLng,
      geofenceRadiusM: s.geofenceRadiusM,
      isActive: s.isActive,
      workerCount: s._count.users,
    }));
  }

  async create(actorId: string, input: SiteInput): Promise<SiteSummary> {
    const site = await this.prisma.site.create({
      data: {
        name: input.name,
        address: input.address,
        geofenceCenterLat: input.geofenceCenterLat,
        geofenceCenterLng: input.geofenceCenterLng,
        geofenceRadiusM: input.geofenceRadiusM,
        isActive: input.isActive ?? true,
      },
    });
    await this.audit.record({
      actorId,
      action: 'site.create',
      targetType: 'site',
      targetId: site.id,
      details: { name: site.name },
    });
    return this.toSummary(site);
  }

  async update(actorId: string, id: string, input: SiteInput): Promise<SiteSummary> {
    const existing = await this.prisma.site.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Site not found');
    const site = await this.prisma.site.update({
      where: { id },
      data: {
        name: input.name,
        address: input.address,
        geofenceCenterLat: input.geofenceCenterLat,
        geofenceCenterLng: input.geofenceCenterLng,
        geofenceRadiusM: input.geofenceRadiusM,
        isActive: input.isActive ?? existing.isActive,
      },
    });
    await this.audit.record({
      actorId,
      action: 'site.update',
      targetType: 'site',
      targetId: id,
    });
    return this.toSummary(site);
  }

  /** Sites are never hard-deleted (attendance records reference them) — deactivate instead. */
  async deactivate(actorId: string, id: string): Promise<SiteSummary> {
    const site = await this.prisma.site.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!site) throw new NotFoundException('Site not found');
    if (site._count.users > 0) {
      throw new BadRequestException('Reassign the workers on this site before deactivating it');
    }
    const updated = await this.prisma.site.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({ actorId, action: 'site.deactivate', targetType: 'site', targetId: id });
    return this.toSummary(updated);
  }

  private toSummary(s: {
    id: string;
    name: string;
    address: string;
    geofenceCenterLat: number;
    geofenceCenterLng: number;
    geofenceRadiusM: number;
    isActive: boolean;
  }): SiteSummary {
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      geofenceCenterLat: s.geofenceCenterLat,
      geofenceCenterLng: s.geofenceCenterLng,
      geofenceRadiusM: s.geofenceRadiusM,
      isActive: s.isActive,
    };
  }
}
