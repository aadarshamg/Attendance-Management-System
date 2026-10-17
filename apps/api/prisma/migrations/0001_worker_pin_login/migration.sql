-- Worker phone + 4-digit PIN login.
ALTER TABLE "attendance"."users" ADD COLUMN "pin_hash" TEXT;
ALTER TABLE "attendance"."users" ADD COLUMN "pin_failed_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attendance"."users" ADD COLUMN "pin_locked_until" TIMESTAMP(3);
ALTER TABLE "attendance"."users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

-- Phones are now stored as the bare 10-digit Indian mobile number so the login
-- lookup is an exact match ("+91-98765 43210" -> "9876543210").
UPDATE "attendance"."users"
SET "phone" = RIGHT(REGEXP_REPLACE("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL AND LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) >= 10;

CREATE INDEX "users_phone_idx" ON "attendance"."users"("phone");
