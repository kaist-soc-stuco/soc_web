CREATE TYPE "public"."content_relation_type" AS ENUM('ANNOUNCEMENT', 'SCHEDULE', 'SURVEY_PERIOD');--> statement-breakpoint
CREATE TYPE "public"."content_relation_sync_mode" AS ENUM('NONE', 'SURVEY_TO_EVENT');--> statement-breakpoint
ALTER TABLE "content_matchers" DROP CONSTRAINT "content_matchers_survey_one_content_target";--> statement-breakpoint
ALTER TABLE "content_matchers" ALTER COLUMN "survey_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD COLUMN "relation_type" "content_relation_type";--> statement-breakpoint
ALTER TABLE "content_matchers" ADD COLUMN "sync_mode" "content_relation_sync_mode" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD COLUMN "updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "content_matchers" ADD COLUMN "synchronized_at" timestamp with time zone;--> statement-breakpoint
UPDATE "content_matchers"
SET "relation_type" = CASE WHEN "article_id" IS NOT NULL THEN 'ANNOUNCEMENT'::"content_relation_type" ELSE 'SURVEY_PERIOD'::"content_relation_type" END,
    "updated_by_user_id" = "created_by_user_id",
    "updated_at" = "created_at";--> statement-breakpoint
ALTER TABLE "content_matchers" ALTER COLUMN "relation_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content_matchers" ALTER COLUMN "updated_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content_matchers" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_exactly_two_subjects" CHECK (num_nonnulls("article_id", "event_id", "survey_id") = 2);--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_relation_type_compatible" CHECK (("relation_type" = 'ANNOUNCEMENT' AND "article_id" IS NOT NULL) OR ("relation_type" = 'SCHEDULE' AND "article_id" IS NOT NULL AND "event_id" IS NOT NULL) OR ("relation_type" = 'SURVEY_PERIOD' AND "event_id" IS NOT NULL AND "survey_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_sync_compatible" CHECK (("sync_mode" = 'NONE' AND "synchronized_at" IS NULL) OR ("sync_mode" = 'SURVEY_TO_EVENT' AND "relation_type" = 'SURVEY_PERIOD' AND "synchronized_at" IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "content_matchers_article_event_unique" ON "content_matchers" USING btree ("article_id", "event_id") WHERE "survey_id" IS NULL;--> statement-breakpoint
CREATE INDEX "content_matchers_article_idx" ON "content_matchers" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "content_matchers_event_idx" ON "content_matchers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "content_matchers_survey_idx" ON "content_matchers" USING btree ("survey_id");
