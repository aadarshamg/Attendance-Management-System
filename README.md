# Attendance Management System

Geo-tagged photo attendance for construction sites. Workers mark check-in / check-out with a **live
camera photo stamped with GPS coordinates, address and time**; the image is **compressed on the device**
to ~100–300 KB; **image binaries are auto-purged after 90 days while every text record is kept forever.**

## What's implemented

| Area | Status |
|---|---|
| Worker: login, DPDP consent gate, camera+GPS capture, client watermark + compression, upload, history | ✅ |
| Server: authoritative time, PostGIS geofence, Nominatim reverse geocoding, flagging, R2 upload, audit log | ✅ |
| Roles: **worker**, **supervisor** (site-scoped), **admin** (company-wide) | ✅ |
| Admin dashboard: records list + filters + detail + map + CSV/XLSX export | ✅ |
| Supervisor / admin **review & override** of a record's verified status, with note + audit | ✅ |
| Admin CRUD: workers & staff (assign site, reset password, deactivate), sites & geofences (map picker) | ✅ |
| Audit-log viewer | ✅ |
| 90-day image purge: daily cron + manual CLI + storage lifecycle rule | ✅ |
| Security: JWT + RBAC, `helmet`, login rate-limiting, short-lived signed image URLs | ✅ |
| PWA install; Docker images + full compose stack; GitHub Actions CI | ✅ |
| Deferred: offline capture, face-match/liveness, payroll/overtime, live "on-site" map, push alerts | ⏳ |

## Stack

- **Web** — React 18 + Vite 7 PWA, TanStack Query, React Router 7 (lazy admin routes), Leaflet.
  `browser-image-compression` + `<canvas>` watermark, WebP output (JPEG + EXIF-GPS fallback).
- **API** — NestJS 11, Prisma 5, PostgreSQL + PostGIS, JWT auth, `@nestjs/throttler`, `helmet`,
  `sharp` 0.35, `@nestjs/schedule`.
- **Storage** — Cloudflare R2 (S3-compatible) via AWS SDK v3.
- Monorepo: npm workspaces (`packages/shared`, `apps/api`, `apps/web`).
- `npm audit`: **0 vulnerabilities.**

## Quick start (cloud services)

You need a PostgreSQL + PostGIS database and an S3-compatible bucket. Either **Supabase** alone
(database + storage, one signup) or **Neon + Cloudflare R2**. **Step-by-step: [SETUP.md](SETUP.md).**

```bash
npm install                      # also builds packages/shared

cp .env.example apps/api/.env    # fill DATABASE_URL, JWT_SECRET, S3_*, NOMINATIM_USER_AGENT

npm run db:migrate               # prisma migrate deploy (initial migration is committed) + PostGIS
npm run db:seed                  # admin + supervisor + 2 sites + 3 workers  (passwords: password123)
npm run setup:r2-lifecycle       # optional; auto-expire photos (skipped on providers without it)

npm run dev                      # api https://localhost:3000, web https://localhost:5173
```

Object storage is any S3-compatible provider — `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` / `S3_BUCKET` (`R2_*` names still work). Path-style addressing is the default
and suits R2, Supabase, and MinIO.

The dev server uses **HTTPS** (self-signed) — the camera and Geolocation APIs need a secure context.
Accept the certificate warning. Test on a phone via the LAN URL, or Chrome DevTools device mode + Sensors.

## Quick start (all-in-one Docker)

```bash
docker compose -f docker-compose.full.yml up --build
# open http://localhost:8080   (db + MinIO + API + web; API auto-migrates and seeds on first boot)
```

## Seed logins

| Role | Employee code | Password | Scope |
|---|---|---|---|
| Admin | `ADMIN001` | `password123` | everything |
| Supervisor | `SUP001` | `password123` | Tower-B site only |
| Worker | `W10482`, `W10483` | `password123` | Tower-B |
| Worker | `W20991` | `password123` | Metro site |

## Verify end-to-end

1. **Consent + capture** — log in as `W10482` → accept the consent notice → **Check In** → allow camera +
   location → **Capture** → confirmation shows the server timestamp, resolved address, geofence status;
   the photo carries the burned-in watermark.
2. **Supervisor** — log in as `SUP001` → sees only Tower-B records; opening a Metro record is rejected.
3. **Review** — open a flagged record → set status to **OK**, add a note, **Save review** → the record
   shows "reviewed", and an `attendance.review` row appears in the audit log.
4. **Admin CRUD** — as `ADMIN001`: create a site (click the map to set the geofence centre), create a
   worker on it, then have that worker mark attendance.
5. **Export** — filter records → **Export CSV / Excel** → `attendance.export` audit row is written.
6. **Retention** — `npm run purge:images -- --older-than 0` → the R2 object is deleted, `image_status`
   becomes `purged`, `/admin/records/:id` returns `imageUrl: null`, every text field intact.

## Tests

```bash
npm test    # 29 unit tests: flag rules, geofence Haversine, retention routine, RolesGuard,
            # supervisor site-scoping, user validation, the full mark() pipeline incl. the consent gate
```

## API surface

`POST /auth/login` · `GET /auth/me` · `POST /auth/consent`
`POST /attendance/mark` · `GET /attendance/me`
`GET /admin/attendance` · `GET /admin/attendance/:id` · `PATCH /admin/attendance/:id` (review) · `GET /admin/attendance/export`
`GET /admin/audit`
`GET|POST /admin/users` · `PUT|DELETE /admin/users/:id`
`GET|POST /admin/sites` · `PUT|DELETE /admin/sites/:id`
`GET /health`

## Notes / known trade-offs

- JWT is stored in `localStorage`; move to httpOnly refresh cookies before production.
- Geofence uses a single-row PostGIS `ST_DWithin` (Haversine fallback if PostGIS is unavailable).
- EXIF GPS is written only on the JPEG fallback path (canvas→WebP drops EXIF); the burned-in watermark
  and the DB columns are the source of truth.
- Users and sites are **deactivated, never deleted** — they are referenced by permanent records.
- The Excel export is **SpreadsheetML** (`.xls`, a single XML file Excel/LibreOffice open natively) —
  dependency-free, chosen over a heavier xlsx-zip library for a plain tabular export. CSV is also offered.
- PWA precaches the app shell only; offline *capture* is out of scope.
