#!/bin/sh
set -e

# Apply pending migrations (idempotent) before starting the API.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema prisma/schema.prisma
  npx prisma db execute --file prisma/postgis.sql --schema prisma/schema.prisma || true
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed || true
fi

exec "$@"
