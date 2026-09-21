-- 0007 had a timestamp older than 0006 and could be skipped on upgraded databases.
ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "image_url" text;
