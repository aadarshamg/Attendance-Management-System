import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminRecordQuery,
  AuditEntry,
  AuditQuery,
  RecordDetail,
  RecordReview,
} from '@ams/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImagesService } from '../images/images.service';
import { AuditService } from '../audit/audit.service';
import { recordInclude, toAttendanceRecord } from '../common/record-mapper';
import type { RequestUser } from '../auth/jwt.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
    private readonly audit: AuditService,
  ) {}

  /** Supervisors are locked to their assigned site; admins see everything. */
  private siteScope(user: RequestUser): { siteId?: string } {
    if (user.role === 'admin') return {};
    if (!user.assignedSiteId) {
      throw new ForbiddenException('Supervisor has no assigned site');
    }
    return { siteId: user.assignedSiteId };
  }

  private buildWhere(user: RequestUser, q: AdminRecordQuery): Prisma.AttendanceRecordWhereInput {
    const scope = this.siteScope(user);
    const where: Prisma.AttendanceRecordWhereInput = {};
    if (scope.siteId) where.siteId = scope.siteId;
    else if (q.siteId) where.siteId = q.siteId;
    if (q.workerId) where.workerId = q.workerId;
    if (q.status) where.status = q.status;
    if (q.dateFrom || q.dateTo) {
      where.serverTimestamp = {};
      if (q.dateFrom) where.serverTimestamp.gte = new Date(q.dateFrom);
      if (q.dateTo) where.serverTimestamp.lte = new Date(q.dateTo);
    }
    return where;
  }

  async listRecords(user: RequestUser, q: AdminRecordQuery) {
    const where = this.buildWhere(user, q);
    const [rows, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: recordInclude,
        orderBy: { serverTimestamp: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    return { data: rows.map(toAttendanceRecord), page: q.page, limit: q.limit, total };
  }

  async recordsForExport(user: RequestUser, q: AdminRecordQuery) {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: this.buildWhere(user, q),
      include: recordInclude,
      orderBy: { serverTimestamp: 'desc' },
      take: 50000,
    });
    return rows.map(toAttendanceRecord);
  }

  private async loadScopedRecord(user: RequestUser, id: string) {
    const r = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { ...recordInclude, site: true },
    });
    if (!r) throw new NotFoundException('Record not found');
    const scope = this.siteScope(user);
    if (scope.siteId && r.siteId !== scope.siteId) {
      throw new ForbiddenException('Record is outside your site');
    }
    return r;
  }

  async getRecord(user: RequestUser, id: string): Promise<RecordDetail> {
    const r = await this.loadScopedRecord(user, id);
    const base = toAttendanceRecord({
      ...r,
      site: r.site ? { id: r.site.id, name: r.site.name } : null,
    });
    const imageUrl =
      r.imageStatus === 'stored' && r.imageObjectKey
        ? await this.images.signedGetUrl(r.imageObjectKey)
        : null;
    return {
      ...base,
      imageUrl,
      site: r.site
        ? {
            id: r.site.id,
            name: r.site.name,
            geofenceCenterLat: r.site.geofenceCenterLat,
            geofenceCenterLng: r.site.geofenceCenterLng,
            geofenceRadiusM: r.site.geofenceRadiusM,
          }
        : null,
    };
  }

  async reviewRecord(user: RequestUser, id: string, review: RecordReview): Promise<RecordDetail> {
    const before = await this.loadScopedRecord(user, id);
    await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: review.status,
        manualNote: review.note ?? null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'attendance.review',
      targetType: 'attendance_record',
      targetId: id,
      details: {
        from: before.status,
        to: review.status,
        note: review.note ?? null,
      },
    });
    return this.getRecord(user, id);
  }

  async listAudit(q: AuditQuery): Promise<{ data: AuditEntry[]; page: number; limit: number; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = q.action;
    if (q.actorId) where.actorId = q.actorId;
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorName: r.actor?.name ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        detailsJson: r.detailsJson ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      page: q.page,
      limit: q.limit,
      total,
    };
  }
}
