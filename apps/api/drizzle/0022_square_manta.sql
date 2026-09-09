ALTER TABLE "calendar_sync_job" ADD COLUMN "resource_updated_at" timestamp with time zone;
UPDATE "calendar_sync_job" AS job
SET "resource_updated_at" = event."updated_at"
FROM "calendar_event" AS event
WHERE event."calendar_event_id" = job."calendar_event_id";
ALTER TABLE "calendar_sync_job" ALTER COLUMN "resource_updated_at" SET NOT NULL;
