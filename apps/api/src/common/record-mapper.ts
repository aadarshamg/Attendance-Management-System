import type { AttendanceRecord } from '@ams/shared';
import type { AttendanceRecord as DbRecord, Site, User } from '@prisma/client';

type WithRelations = DbRecord & {
  worker: Pick<User, 'id' | 'name' | 'employeeCode'>;
  site: Pick<Site, 'id' | 'name'> | null;
  reviewedBy?: Pick<User, 'id' | 'name'> | null;
};

export function toAttendanceRecord(r: WithRelations): AttendanceRecord {
  return {
    id: r.id,
    markType: r.markType,
    serverTimestamp: r.serverTimestamp.toISOString(),
    deviceTimestamp: r.deviceTimestamp.toISOString(),
    latitude: r.latitude,
    longitude: r.longitude,
    gpsAccuracyM: r.gpsAccuracyM,
    address: r.address,
    withinGeofence: r.withinGeofence,
    status: r.status,
    flagReasons: r.flagReasons as AttendanceRecord['flagReasons'],
    workerId: r.workerId,
    workerName: r.worker.name,
    employeeCode: r.worker.employeeCode,
    siteId: r.siteId,
    siteName: r.site?.name ?? null,
    imageStatus: r.imageStatus,
    createdAt: r.createdAt.toISOString(),
    manualNote: r.manualNote,
    reviewedById: r.reviewedById,
    reviewedByName: r.reviewedBy?.name ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

export const recordInclude = {
  worker: { select: { id: true, name: true, employeeCode: true } },
  site: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;
