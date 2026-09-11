import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { MarkResponse } from '@ams/shared';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeofenceService } from '../geofence/geofence.service';
import { GeocodeService } from '../geocode/geocode.service';
import { ImagesService } from '../images/images.service';
import { recordInclude, toAttendanceRecord } from '../common/record-mapper';
import type { RequestUser } from '../auth/jwt.types';
import type { MarkDto } from './mark.dto';
import { computeFlags } from './flags';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly geofence: GeofenceService,
    private readonly geocode: GeocodeService,
    private readonly images: ImagesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async mark(user: RequestUser, dto: MarkDto, file?: Express.Multer.File): Promise<MarkResponse> {
    if (!file) throw new BadRequestException('A camera photo is required');

    // DPDP: a worker must have consented to photo + location collection before any mark.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { consentedAt: true },
    });
    if (!dbUser?.consentedAt) {
      throw new ForbiddenException('CONSENT_REQUIRED');
    }

    const serverTimestamp = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    const siteId = user.assignedSiteId;

    // 1. Normalize/validate the image (server-side safeguard).
    const canonical = await this.images.normalize(file);

    // 2. Geofence — server-authoritative.
    const withinGeofence = siteId
      ? await this.geofence.isWithinSiteGeofence(siteId, dto.latitude, dto.longitude)
      : false;

    // 3. Reverse geocode (fail-soft).
    const address = await this.geocode.reverseGeocode(dto.latitude, dto.longitude);

    // 4. Flag rules.
    const driftSec = Math.abs(serverTimestamp.getTime() - deviceTimestamp.getTime()) / 1000;
    const { status, flagReasons } = computeFlags({
      hasAssignedSite: Boolean(siteId),
      withinGeofence,
      gpsAccuracyM: dto.gpsAccuracyM,
      accuracyThresholdM: this.config.geofenceAccuracyThresholdM,
      driftSeconds: driftSec,
      driftThresholdSeconds: this.config.timeDriftThresholdSeconds,
    });

    // 5. Persist the record first (so we have an id for the object key).
    const record = await this.prisma.attendanceRecord.create({
      data: {
        workerId: user.id,
        siteId,
        markType: dto.markType,
        serverTimestamp,
        deviceTimestamp,
        latitude: dto.latitude,
        longitude: dto.longitude,
        gpsAccuracyM: dto.gpsAccuracyM,
        address,
        withinGeofence,
        status,
        flagReasons,
        imageStatus: 'stored',
      },
      include: recordInclude,
    });

    // 6. Upload the image; attach the key. If upload fails, keep the text record
    //    (the source of truth) and mark the image as already purged.
    const key = this.images.objectKey(record.id, serverTimestamp);
    try {
      await this.images.upload(key, canonical);
      await this.prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { imageObjectKey: key },
      });
    } catch (err) {
      this.logger.error(`Image upload failed for record ${record.id}`, err as Error);
      await this.prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { imageStatus: 'purged' },
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: 'attendance.mark',
      targetType: 'attendance_record',
      targetId: record.id,
      details: { status, flagReasons, withinGeofence },
    });

    const mapped = toAttendanceRecord(record);
    return {
      id: mapped.id,
      markType: mapped.markType,
      serverTimestamp: mapped.serverTimestamp,
      deviceTimestamp: mapped.deviceTimestamp,
      latitude: mapped.latitude,
      longitude: mapped.longitude,
      gpsAccuracyM: mapped.gpsAccuracyM,
      address: mapped.address,
      withinGeofence: mapped.withinGeofence,
      status: mapped.status,
      flagReasons: mapped.flagReasons,
    };
  }

  async myRecords(userId: string, page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { workerId: userId },
        include: recordInclude,
        orderBy: { serverTimestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceRecord.count({ where: { workerId: userId } }),
    ]);
    return { data: rows.map(toAttendanceRecord), page, limit, total };
  }
}
