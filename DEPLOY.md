# Deploying (GitHub + Vercel)

The code is ready and committed locally. Three things left, all needing your accounts —
I don't have GitHub/Vercel access to do them for you.

---

## 1. Push to GitHub

**github.com → New repository** (top right, "+" → New repository). Suggested name
`attendance-management-system`, visibility **Private** (recommended — it's a real client
project). Don't initialize it with a README/gitignore (we already have those).

Then, in a terminal here:

```powershell
cd "y:\scratch\Attandance Management System"
git remote add origin https://github.com/<your-username>/attendance-management-system.git
git branch -M main
git push -u origin main
```

(If you use SSH instead of HTTPS for GitHub, use the `git@github.com:...` URL instead.)

---

## 2. Vercel project #1 — the API

**vercel.com → Add New → Project → Import** the repo you just pushed.

| Setting | Value |
|---|---|
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Build/Install commands | leave default — `apps/api/vercel.json` already sets the build command (generates the Prisma client, runs migrations, seeds) |

**Environment Variables** (Settings → Environment Variables, or during import) — add for
**all environments** (Production, Preview, Development). If you already set these with
`sslmode=require`, **update both to `sslmode=no-verify`** — that was the actual cause of the
`P1001: Can't reach database server` build failure (Prisma's `require` does full certificate
verification against Supabase's pooler and fails; `no-verify` still encrypts, it just skips that
check). The database is now migrated and seeded for real, so the next deploy should succeed
cleanly once these two values are corrected:

```
DATABASE_URL          postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=no-verify&pgbouncer=true&connect_timeout=10
DIRECT_URL             postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify&connect_timeout=10
JWT_SECRET             <a long random string>
S3_ENDPOINT            https://<ref>.supabase.co/storage/v1/s3
S3_REGION               <your Supabase project's region>
S3_ACCESS_KEY_ID        <from Supabase Storage S3 Connection>
S3_SECRET_ACCESS_KEY    <from Supabase Storage S3 Connection>
S3_BUCKET               ams-attendance-images
S3_FORCE_PATH_STYLE     true
NOMINATIM_USER_AGENT    AttendanceMgmtSystem/1.0 (contact: your-real-email)
CRON_SECRET             <a different long random string — protects the daily purge endpoint>
CORS_ORIGIN             https://localhost:5173
```

(Same values as your local `apps/api/.env` — copy them across. `CORS_ORIGIN` is a
placeholder for now; you'll update it in step 4.)

**Deploy.** Watch the build log — this is the step that runs the database migration; it's
running on Vercel's Linux build machine, not your Windows one, so the local networking
issue we hit earlier shouldn't apply here. If it fails on the migration step specifically,
that's useful new information — send me the log.

When it succeeds, note the assigned URL, e.g. `https://ams-api-yourname.vercel.app`.

Quick check: open `https://<that-url>/health` in a browser — should return
`{"status":"ok","db":true,...}`.

---

## 3. Vercel project #2 — the web app

**Add New → Project → Import** the **same** repo again (a second, separate Vercel project).

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Framework Preset | Vite (auto-detected) |

**Environment Variables:**
```
VITE_API_BASE_URL   https://<the API URL from step 2>
```

**Deploy.** Note this URL too, e.g. `https://ams-web-yourname.vercel.app`.

---

## 4. Close the loop: point the API's CORS at the web URL

Back in the **API** project → Settings → Environment Variables → edit `CORS_ORIGIN` →
set it to the web app's URL from step 3 → **Redeploy** (Deployments tab → ⋯ → Redeploy).

---

## 5. Try it

Open the web URL. Real HTTPS this time, so no certificate warning — camera and GPS should
just work, including on your phone.

| Employee code | Password |
|---|---|
| `ADMIN001` | `password123` |
| `W10482` | `password123` |

**Change or remove these before this is a real production URL** — they're seed/demo
accounts, currently re-created on every deploy (see "Notes" below).

---

## Notes

- **Every deploy re-runs migrate only, not seed.** `apps/api/vercel.json`'s `buildCommand`
  used to also run `npm run db:seed` on every deploy — useful while there was no working
  local connection, but it kept recreating the demo accounts forever. Now that real data
  is in use, seeding only happens when you explicitly run `npm run db:seed` yourself. If
  you ever need the demo accounts back (a fresh throwaway environment, testing), run that
  manually or temporarily re-add `&& npm run db:seed` to the build command.
- **Preview deployments** (every PR) run against the **same** database as Production right
  now, since there's only one `DATABASE_URL` configured. Fine for now; before this is a
  real production system, give Preview its own Supabase branch/project.
- **The daily image-purge cron** is configured in `apps/api/vercel.json` (`crons`) and
  calls `GET /internal/retention/purge` with `Authorization: Bearer $CRON_SECRET` —
  Vercel sends that header automatically once `CRON_SECRET` is set. Cron Jobs need a
  Vercel **Pro** plan to run on a schedule other than once a day; the once-daily schedule
  here works on the free Hobby plan.
- Local dev (`npm run dev`) and the Docker path (`docker-compose.full.yml`) still work
  exactly as before — this deploy path is additive, not a replacement.
- **A request that just hangs with no response and nothing in the logs** (as opposed to a
  fast error) means the DB connection stalled rather than failed — Vercel's own function
  timeout silently kills it with no log line. Fixed by two things already in the repo:
  `connect_timeout=10` on both connection strings (Prisma gives up with a clear error
  instead of hanging forever) and `functions.api/index.ts.maxDuration: 30` in
  `apps/api/vercel.json` (room to actually see that error instead of a silent platform
  kill). If you still see silent hangs after both are in place, that's worth reporting back.
