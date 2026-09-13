UPDATE "vote" SET "quorum_percent" = 50 WHERE "quorum_percent" IS NULL;
--> statement-breakpoint
ALTER TABLE "vote" ALTER COLUMN "quorum_percent" SET DEFAULT 50;
