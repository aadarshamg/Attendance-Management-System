# Attendance Management System

Geo-tagged photo attendance for construction sites. Workers mark check-in / check-out with a **live
camera photo stamped with GPS coordinates, address and time**; the image is **compressed on the device**
to ~100–300 KB; **image binaries are auto-purged after 90 days while every text record is kept forever.**

## What's implemented

| Area | Status |
|---|---|
| Worker: **phone + 4-digit PIN login** (stays signed in 90 days), one-button "Start work / End work", English ⇄ हिंदी | ✅ |
| Worker: DPDP consent gate, camera+GPS capture, client watermark + compression, upload, history | ✅ |
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

| Role | Employee code | Password | Phone + PIN (workers) | Scope |
|---|---|---|---|---|
| Admin | `ADMIN001` | `password123` | — | everything |
| Supervisor | `SUP001` | `password123` | — | Tower-B site only |
| Worker | `W10482`, `W10483` | `password123` | `9000000001`, `9000000002` / PIN `1234` | Tower-B |
| Worker | `W20991` | `password123` | `9000000003` / PIN `1234` | Metro site |

**Change `ADMIN001`'s password after the first login** (Admin → Users → Edit) — the seed values are public.

## Worker login (phone + PIN)

Workers don't type codes or passwords. The admin adds each worker in **Admin → Users** with their
**10-digit mobile number** and a **4-digit PIN**, and tells the worker the PIN. The worker opens the
app (`/login`), types the number and PIN on the number pad, and stays signed in on that phone for
90 days (`WORKER_JWT_TTL`).

- **Forgotten PIN** — the admin sets a new one from the Users page.
- **5 wrong PINs** lock that worker's PIN login for 15 minutes; an admin PIN reset unlocks it at once.
- **Lost phone / worker leaves** — reset the PIN or deactivate the worker: every signed-in phone is
  logged out on its next request.
- Office staff (supervisor, admin) have their own link, **`/staff`**, with employee code + password.
  Workers never see it. Opening `/admin` while signed out also lands there.

The worker screens (login, home, camera, history, consent) have an **English ⇄ हिंदी** switch;
problems are shown in plain words with what to do (e.g. "📍 Location is off — turn on Location…").

## Verify end-to-end

1. **Consent + capture** — at `/login` log in with `9000000001` / PIN `1234` → accept the consent
   notice → **Start work** → allow camera + location → **Take photo** → **Done — Save** → the confirmation
   shows the server time; the home button now reads **End work**. The admin record shows the resolved
   address and geofence status, and the photo carries the burned-in watermark.
2. **Supervisor** — at `/staff` log in as `SUP001` → sees only Tower-B records; opening a Metro record is rejected.
3. **Review** — open a flagged record → set status to **OK**, add a note, **Save review** → the record
   shows "reviewed", and an `attendance.review` row appears in the audit log.
4. **Admin CRUD** — as `ADMIN001`: create a site (click the map to set the geofence centre), create a
   worker on it, then have that worker mark attendance.
5. **Export** — filter records → **Export CSV / Excel** → `attendance.export` audit row is written.
6. **Retention** — `npm run purge:images -- --older-than 0` → the R2 object is deleted, `image_status`
   becomes `purged`, `/admin/records/:id` returns `imageUrl: null`, every text field intact.

## Tests

```bash
npm test    # 46 unit tests: flag rules, geofence Haversine, retention routine, RolesGuard,
            # supervisor site-scoping, user + PIN validation, PIN login lockout,
            # the full mark() pipeline incl. the consent gate
```

## API surface

`POST /auth/login` · `POST /auth/pin-login` · `GET /auth/me` · `POST /auth/consent`
`POST /attendance/mark` · `GET /attendance/me` · `GET /attendance/me/photo`
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
