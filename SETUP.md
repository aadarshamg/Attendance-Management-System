# Setup

You need a PostgreSQL database (with PostGIS) and an S3-compatible bucket for photos.

- **Option A — Supabase only** — one signup covers both. Recommended for a fresh setup.
- **Option B — Neon + Cloudflare R2** — two services.
- **Option C — join a Supabase project another app of yours already uses** — same client,
  one Postgres instance, no new signup.

Either way it's ~10 minutes, both free.

---

# Option C — share an existing Supabase project (e.g. with another app for the same client)

All of this app's tables live in their own Postgres **schema** — `attendance` — instead of
`public` (see `prisma/schema.prisma`, `schemas = ["attendance", "extensions"]` +
`@@schema("attendance")` on every model). That means it's safe to point `DATABASE_URL` and the
`S3_*` values at a Supabase project another app already uses: nothing this app creates can
collide with that app's tables in `public`, even if both happen to want the same table name
(this project uses `attendance.audit_log`, `attendance.users`, `attendance.sites`, etc. —
never bare `public.*`).

1. Open the **other app's** Supabase project (dashboard → the project you already have).
2. **Database → Extensions** → enable `postgis` if it isn't already (installs into the
   `extensions` schema, which the migration also expects).
3. **Project Settings → Database → Connection string → "Session pooler" tab** (port 5432) →
   that's your `DATABASE_URL`. The migration will create the `attendance` schema itself —
   it does not touch anything already in `public`.
4. **Storage → New bucket** → `ams-attendance-images` (a new bucket, separate from anything
   the other app stores) → keep it private.
5. **Project Settings → Storage → S3 Connection** → note the endpoint and region, then
   **New access key** → `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.
6. Fill `apps/api/.env` the same as Option A (below), pointing at this project.

**Later, linking the two apps' data** (e.g. matching this app's `sites` to the other app's
`projects`, or unifying login): both are just tables/schemas in the same Postgres instance now,
so that's a normal SQL migration when you're ready — a nullable reference column, a view, or a
foreign key across schemas. Nothing here needs to change to make that possible later; it's
listed as a deliberate non-goal today, not a limitation.

---

# Option A — Supabase (database + storage in one)

## A1. Create the project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Set a **database password** (save it somewhere) and pick a region close to you → Create.
   Wait ~2 min for it to provision.

## A2. Enable PostGIS

**Database** (left sidebar) → **Extensions** → search **`postgis`** → toggle it **on**.

## A3. Get the connection string

**Project Settings** → **Database** → **Connection string** → click the **`Session pooler`** tab
(port `5432` — this one works for migrations and doesn't need IPv6).

It looks like:
```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```
Replace `[YOUR-PASSWORD]` with the password from step A1. That's your `DATABASE_URL`.

## A4. Create the storage bucket

**Storage** → **New bucket** → name it exactly `ams-attendance-images` → keep **Public** OFF
(the app serves photos through short-lived signed URLs) → Create.

## A5. Get S3 access keys

**Project Settings** → **Storage** → scroll to **S3 Connection**:
- Note the **Endpoint**: `https://<your-ref>.supabase.co/storage/v1/s3`
- Note the **Region**: e.g. `ap-south-1` (your project's region)
- Click **New access key** → copy the **Access key ID** and **Secret access key** (shown once)

## A6. Fill `apps/api/.env`

```powershell
cd "y:\scratch\Attandance Management System"
copy .env.example apps\api\.env
```

Edit `apps\api\.env`:
```ini
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# generate with:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET="<paste generated string>"

S3_ENDPOINT="https://<your-ref>.supabase.co/storage/v1/s3"
S3_REGION="<your project region, e.g. ap-south-1>"
S3_ACCESS_KEY_ID="<from step A5>"
S3_SECRET_ACCESS_KEY="<from step A5>"
S3_BUCKET="ams-attendance-images"
S3_FORCE_PATH_STYLE="true"

NOMINATIM_USER_AGENT="AttendanceMgmtSystem/1.0 (contact: your-real-email)"
```
Leave everything else as-is. Skip to **Run** below.

---

# Option B — Neon + Cloudflare R2

## B1. Neon (database)

1. **https://neon.tech** → sign up → **Create project** → pick a region.
2. On the project page find **Connection string**, **turn OFF "Connection pooling"** before copying
   (migrations need a direct connection). That whole line is your `DATABASE_URL`.
3. PostGIS turns itself on during the migration, into its own `extensions` schema. (To verify:
   Neon **SQL Editor** → `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;`)

## B2. Cloudflare R2 (storage)

1. **https://dash.cloudflare.com** → **R2** → **Create bucket** → `ams-attendance-images`.
2. **Manage R2 API Tokens** → **Create API token** → *Object Read & Write*, scoped to that bucket.
3. Copy the **Access Key ID**, **Secret Access Key**, and **S3 API endpoint**
   (`https://<account-id>.r2.cloudflarestorage.com`).

## B3. Fill `apps/api/.env`

```powershell
cd "y:\scratch\Attandance Management System"
copy .env.example apps\api\.env
```
```ini
DATABASE_URL="<Neon direct string>"
JWT_SECRET="<generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_ACCESS_KEY_ID="<from B2>"
S3_SECRET_ACCESS_KEY="<from B2>"
S3_BUCKET="ams-attendance-images"
S3_FORCE_PATH_STYLE="true"
NOMINATIM_USER_AGENT="AttendanceMgmtSystem/1.0 (contact: your-real-email)"
```

---

# Run

```powershell
npm install
npm run db:migrate            # creates the tables (+ PostGIS)
npm run db:seed               # ADMIN001 / SUP001 / workers — password: password123
npm run setup:r2-lifecycle    # optional; Supabase will say "not supported", which is fine
npm run dev                   # API :3000, web :5173
```

Open **https://localhost:5173**, accept the certificate warning, log in:

| Employee code | Password | Lands on |
|---|---|---|
| `ADMIN001` | `password123` | the dashboard |
| `W10482` | `password123` | worker check-in/out |

---

# Troubleshooting

| Symptom | Fix |
|---|---|
| `db:migrate` hangs / "can't reach database" | **Neon:** you copied the *pooled* string — recopy with pooling off. **Supabase:** use the **Session pooler** string (port 5432), not "Direct connection". |
| `prepared statement already exists` on Supabase | You used the **Transaction pooler** (port 6543). Switch to **Session pooler** (5432). |
| migrate: `type "geography" does not exist` | PostGIS not enabled — Supabase: Database → Extensions → enable `postgis`. Then re-run. |
| Dashboard loads but panels are empty / 500 | API not running or `.env` wrong — check the `npm run dev` terminal. |
| Record opens but the photo doesn't load | Wrong S3 keys, or `S3_BUCKET` doesn't match the bucket name, or `S3_FORCE_PATH_STYLE` isn't `true`. |
| `setup:r2-lifecycle` errors | Non-fatal — the API's daily cron still purges photos after 90 days. |
| Camera/GPS blocked in the browser | Use the **https** URL and accept the self-signed cert. |
