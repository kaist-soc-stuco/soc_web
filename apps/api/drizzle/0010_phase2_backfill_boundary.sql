ALTER TABLE "authorization_backfill_progress" ADD COLUMN IF NOT EXISTS "last_processed_created_at" timestamptz;
ALTER TABLE "authorization_backfill_progress" ADD COLUMN IF NOT EXISTS "upper_bound_created_at" timestamptz;
CREATE INDEX IF NOT EXISTS "users_created_at_id_idx" ON "users" USING btree ("created_at", "id");
