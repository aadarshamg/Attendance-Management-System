/** Centralised, typed access to environment configuration. */
export interface AppConfig {
  jwtSecret: string;
  jwtTtl: string;
  /** S3-compatible object storage: Cloudflare R2, Supabase Storage, AWS S3, MinIO… */
  storage: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
  };
  nominatim: {
    baseUrl: string;
    userAgent: string;
  };
  geofenceAccuracyThresholdM: number;
  timeDriftThresholdSeconds: number;
  imageRetentionDays: number;
  maxUploadBytes: number;
  signedUrlTtlSeconds: number;
}

export function loadConfig(): AppConfig {
  const req = (...keys: string[]): string => {
    for (const k of keys) {
      const v = process.env[k];
      if (v) return v;
    }
    throw new Error(`Missing required env var: ${keys.join(' / ')}`);
  };
  const opt = (dflt: string, ...keys: string[]): string => {
    for (const k of keys) {
      const v = process.env[k];
      if (v) return v;
    }
    return dflt;
  };
  const num = (k: string, dflt: number): number => {
    const v = process.env[k];
    return v === undefined || v === '' ? dflt : Number(v);
  };
  const bool = (k: string, dflt: boolean): boolean => {
    const v = process.env[k];
    if (v === undefined || v === '') return dflt;
    return v === 'true' || v === '1';
  };

  return {
    jwtSecret: req('JWT_SECRET'),
    jwtTtl: process.env.JWT_TTL ?? '12h',
    storage: {
      // R2_* names kept for compatibility; S3_* are accepted too.
      endpoint: req('S3_ENDPOINT', 'R2_ENDPOINT'),
      region: opt('auto', 'S3_REGION', 'R2_REGION'),
      accessKeyId: req('S3_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
      secretAccessKey: req('S3_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
      bucket: req('S3_BUCKET', 'R2_BUCKET'),
      // Path-style works for R2, Supabase, and MinIO; virtual-host is AWS S3's default.
      forcePathStyle: bool('S3_FORCE_PATH_STYLE', true),
    },
    nominatim: {
      baseUrl: process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org',
      userAgent:
        process.env.NOMINATIM_USER_AGENT ?? 'AttendanceMgmtSystem/1.0 (contact: unset@example.com)',
    },
    geofenceAccuracyThresholdM: num('GEOFENCE_ACCURACY_THRESHOLD_M', 100),
    timeDriftThresholdSeconds: num('TIME_DRIFT_THRESHOLD_SECONDS', 300),
    imageRetentionDays: num('IMAGE_RETENTION_DAYS', 90),
    maxUploadBytes: num('MAX_UPLOAD_BYTES', 614400),
    signedUrlTtlSeconds: num('SIGNED_URL_TTL_SECONDS', 300),
  };
}

export const APP_CONFIG = 'APP_CONFIG';
