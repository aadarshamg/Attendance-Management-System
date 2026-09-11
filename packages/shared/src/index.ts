import { z } from 'zod';

export const Role = z.enum(['worker', 'supervisor', 'admin']);
export type Role = z.infer<typeof Role>;

/** Roles allowed into the admin dashboard (supervisors are scoped to their site). */
export const STAFF_ROLES: Role[] = ['supervisor', 'admin'];

export const MarkType = z.enum(['check_in', 'check_out']);
export type MarkType = z.infer<typeof MarkType>;

export const RecordStatus = z.enum(['ok', 'flagged']);
export type RecordStatus = z.infer<typeof RecordStatus>;

export const ImageStatus = z.enum(['stored', 'purged']);
export type ImageStatus = z.infer<typeof ImageStatus>;

export const FlagReason = z.enum([
  'outside_geofence',
  'low_gps_accuracy',
  'device_time_drift',
  'no_assigned_site',
]);
export type FlagReason = z.infer<typeof FlagReason>;

// ---------- Auth ----------

export const LoginRequest = z.object({
  employeeCode: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const AuthUser = z.object({
  id: z.string(),
  name: z.string(),
  role: Role,
  employeeCode: z.string(),
  assignedSiteId: z.string().nullable(),
  assignedSiteName: z.string().nullable(),
  /** ISO timestamp of DPDP consent, or null if not yet given (workers only). */
  consentedAt: z.string().datetime().nullable(),
});
export type AuthUser = z.infer<typeof AuthUser>;

export const LoginResponse = z.object({
  token: z.string(),
  user: AuthUser,
});
export type LoginResponse = z.infer<typeof LoginResponse>;

/** Plain-language notice shown before a worker consents (DPDP Act 2023, §11.1). */
export const CONSENT_NOTICE =
  'To record your attendance, this app captures a photo of you and your GPS location each time you ' +
  'check in or out. This data is used only to verify attendance. Photos are automatically deleted ' +
  'after 90 days; attendance records (time, location, address) are kept as an employment record. ' +
  'You can view your own records in the app and raise a grievance with your site administrator.';

export const ConsentResponse = z.object({ consentedAt: z.string().datetime() });
export type ConsentResponse = z.infer<typeof ConsentResponse>;

// ---------- Attendance mark ----------

/** The non-file fields of the multipart POST /attendance/mark request. */
export const MarkFields = z.object({
  markType: MarkType,
  latitude: z.coerce.number().gte(-90).lte(90),
  longitude: z.coerce.number().gte(-180).lte(180),
  gpsAccuracyM: z.coerce.number().nonnegative().max(100000),
  deviceTimestamp: z.string().datetime(),
});
export type MarkFields = z.infer<typeof MarkFields>;

export const MarkResponse = z.object({
  id: z.string(),
  markType: MarkType,
  serverTimestamp: z.string().datetime(),
  deviceTimestamp: z.string().datetime(),
  latitude: z.number(),
  longitude: z.number(),
  gpsAccuracyM: z.number(),
  address: z.string().nullable(),
  withinGeofence: z.boolean(),
  status: RecordStatus,
  flagReasons: z.array(FlagReason),
});
export type MarkResponse = z.infer<typeof MarkResponse>;

// ---------- Records ----------

export const AttendanceRecord = MarkResponse.extend({
  workerId: z.string(),
  workerName: z.string(),
  employeeCode: z.string(),
  siteId: z.string().nullable(),
  siteName: z.string().nullable(),
  imageStatus: ImageStatus,
  createdAt: z.string().datetime(),
  /** Supervisor/admin review trail. */
  manualNote: z.string().nullable(),
  reviewedById: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
});
export type AttendanceRecord = z.infer<typeof AttendanceRecord>;

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export const AdminRecordQuery = z.object({
  workerId: z.string().optional(),
  siteId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: RecordStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
});
export type AdminRecordQuery = z.infer<typeof AdminRecordQuery>;

export const ExportFormat = z.enum(['csv', 'xlsx']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const RecordDetail = AttendanceRecord.extend({
  imageUrl: z.string().url().nullable(),
  site: z
    .object({
      id: z.string(),
      name: z.string(),
      geofenceCenterLat: z.number(),
      geofenceCenterLng: z.number(),
      geofenceRadiusM: z.number(),
    })
    .nullable(),
});
export type RecordDetail = z.infer<typeof RecordDetail>;

/** Supervisor/admin override of a record's verification outcome. */
export const RecordReview = z.object({
  status: RecordStatus,
  note: z.string().max(1000).optional(),
});
export type RecordReview = z.infer<typeof RecordReview>;

// ---------- Sites ----------

export const SiteSummary = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  geofenceCenterLat: z.number(),
  geofenceCenterLng: z.number(),
  geofenceRadiusM: z.number(),
  isActive: z.boolean(),
  workerCount: z.number().int().nonnegative().optional(),
});
export type SiteSummary = z.infer<typeof SiteSummary>;

export const SiteInput = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  geofenceCenterLat: z.number().gte(-90).lte(90),
  geofenceCenterLng: z.number().gte(-180).lte(180),
  geofenceRadiusM: z.number().int().positive().max(10000),
  isActive: z.boolean().optional(),
});
export type SiteInput = z.infer<typeof SiteInput>;

// ---------- Users ----------

export const UserSummary = z.object({
  id: z.string(),
  name: z.string(),
  role: Role,
  employeeCode: z.string(),
  phone: z.string().nullable(),
  assignedSiteId: z.string().nullable(),
  assignedSiteName: z.string().nullable(),
  isActive: z.boolean(),
  consentedAt: z.string().datetime().nullable(),
});
export type UserSummary = z.infer<typeof UserSummary>;

export const UserCreateInput = z.object({
  name: z.string().min(1).max(200),
  role: Role,
  employeeCode: z.string().min(1).max(64),
  phone: z.string().max(32).optional(),
  assignedSiteId: z.string().nullable().optional(),
  password: z.string().min(8).max(256),
});
export type UserCreateInput = z.infer<typeof UserCreateInput>;

export const UserUpdateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  role: Role.optional(),
  phone: z.string().max(32).nullable().optional(),
  assignedSiteId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(256).optional(),
});
export type UserUpdateInput = z.infer<typeof UserUpdateInput>;

// ---------- Audit ----------

export const AuditEntry = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  detailsJson: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AuditQuery = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

export const ACCEPTED_IMAGE_MIME = ['image/webp', 'image/jpeg'] as const;
