import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * True when (lat,lng) is within the site's geofence radius. Uses PostGIS
   * `ST_DWithin` on `geography` for an accurate spheroidal distance. Falls back
   * to a Haversine calculation if PostGIS is unavailable.
   */
  async isWithinSiteGeofence(siteId: string, lat: number, lng: number): Promise<boolean> {
    try {
      // Schema- and extension-qualified so this doesn't depend on the connection's
      // search_path (Supabase adds "extensions" to it by convention, but a plain
      // Postgres role won't). "attendance" is this app's own Postgres schema —
      // see schema.prisma — kept separate so it can share a Postgres
      // instance/project with another app without name collisions.
      const rows = await this.prisma.$queryRaw<{ within: boolean }[]>`
        SELECT extensions.ST_DWithin(
          extensions.ST_MakePoint(s.geofence_center_lng, s.geofence_center_lat)::extensions.geography,
          extensions.ST_MakePoint(${lng}::float8, ${lat}::float8)::extensions.geography,
          s.geofence_radius_m
        ) AS within
        FROM attendance.sites s
        WHERE s.id = ${siteId}
      `;
      if (rows.length > 0) return rows[0].within;
      return false;
    } catch (err) {
      this.logger.warn(`PostGIS geofence check failed, falling back to Haversine: ${String(err)}`);
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      if (!site) return false;
      const d = haversineMeters(
        lat,
        lng,
        site.geofenceCenterLat,
        site.geofenceCenterLng,
      );
      return d <= site.geofenceRadiusM;
    }
  }
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371008.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
