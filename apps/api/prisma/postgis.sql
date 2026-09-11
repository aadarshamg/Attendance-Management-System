-- Idempotent. Run after `prisma migrate`. Mirrors what the migration already
-- does, so `db:seed`/CI stay correct even if the extension step was skipped
-- (e.g. a restricted DB role couldn't create it during migrate).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Geofence checks are a single-row PK lookup on `attendance.sites`, so no
-- stored geography column or GiST index is needed. Distance uses PostGIS
-- `geography` for an accurate spheroidal result:
--   SELECT extensions.ST_DWithin(
--     extensions.ST_MakePoint(geofence_center_lng, geofence_center_lat)::extensions.geography,
--     extensions.ST_MakePoint($lng, $lat)::extensions.geography,
--     geofence_radius_m
--   ) FROM attendance.sites WHERE id = $siteId;
