-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "attendance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";

-- CreateEnum
CREATE TYPE "attendance"."Role" AS ENUM ('worker', 'supervisor', 'admin');

-- CreateEnum
CREATE TYPE "attendance"."MarkType" AS ENUM ('check_in', 'check_out');

-- CreateEnum
CREATE TYPE "attendance"."RecordStatus" AS ENUM ('ok', 'flagged');

-- CreateEnum
CREATE TYPE "attendance"."ImageStatus" AS ENUM ('stored', 'purged');

-- CreateTable
CREATE TABLE "attendance"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "attendance"."Role" NOT NULL DEFAULT 'worker',
    "phone" TEXT,
    "employee_code" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "assigned_site_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consented_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance"."sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "geofence_center_lat" DOUBLE PRECISION NOT NULL,
    "geofence_center_lng" DOUBLE PRECISION NOT NULL,
    "geofence_radius_m" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance"."attendance_records" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "site_id" TEXT,
    "mark_type" "attendance"."MarkType" NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL,
    "device_timestamp" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "gps_accuracy_m" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "within_geofence" BOOLEAN NOT NULL,
    "status" "attendance"."RecordStatus" NOT NULL DEFAULT 'ok',
    "flag_reasons" TEXT[],
    "image_object_key" TEXT,
    "image_status" "attendance"."ImageStatus" NOT NULL DEFAULT 'stored',
    "manual_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance"."audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance"."geocode_cache" (
    "id" TEXT NOT NULL,
    "lat_key" DOUBLE PRECISION NOT NULL,
    "lng_key" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "attendance"."users"("employee_code");

-- CreateIndex
CREATE INDEX "attendance_records_worker_id_server_timestamp_idx" ON "attendance"."attendance_records"("worker_id", "server_timestamp");

-- CreateIndex
CREATE INDEX "attendance_records_site_id_server_timestamp_idx" ON "attendance"."attendance_records"("site_id", "server_timestamp");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance"."attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_records_image_status_server_timestamp_idx" ON "attendance"."attendance_records"("image_status", "server_timestamp");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "attendance"."audit_log"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_lat_key_lng_key_key" ON "attendance"."geocode_cache"("lat_key", "lng_key");

-- AddForeignKey
ALTER TABLE "attendance"."users" ADD CONSTRAINT "users_assigned_site_id_fkey" FOREIGN KEY ("assigned_site_id") REFERENCES "attendance"."sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance"."attendance_records" ADD CONSTRAINT "attendance_records_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "attendance"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance"."attendance_records" ADD CONSTRAINT "attendance_records_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "attendance"."sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance"."attendance_records" ADD CONSTRAINT "attendance_records_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "attendance"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance"."audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "attendance"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

