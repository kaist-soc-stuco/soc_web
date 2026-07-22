ALTER TABLE "board" RENAME COLUMN "description" TO "description_ko";--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "description_en" varchar(255);--> statement-breakpoint
UPDATE "board" SET "description_en" = "description_ko" WHERE "description_en" IS NULL;--> statement-breakpoint
ALTER TABLE "article" RENAME COLUMN "event_description" TO "event_description_ko";--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "event_description_en" text;
