ALTER TABLE "survey" ADD COLUMN "lifecycle_status" varchar(20) DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN "previous_version_id" uuid;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN "version_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "survey"
SET "lifecycle_status" = CASE
  WHEN "is_published" THEN 'PUBLISHED'
  ELSE 'DRAFT'
END;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_previous_version_id_survey_survey_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."survey"("survey_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_lifecycle_created_idx" ON "survey" USING btree ("lifecycle_status","created_at");--> statement-breakpoint
CREATE INDEX "survey_previous_version_idx" ON "survey" USING btree ("previous_version_id");--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_lifecycle_status_check" CHECK ("survey"."lifecycle_status" in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_lifecycle_published_check" CHECK (("survey"."lifecycle_status" = 'PUBLISHED') = "survey"."is_published");--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_lifecycle_archived_at_check" CHECK (("survey"."lifecycle_status" = 'ARCHIVED') = ("survey"."archived_at" is not null));--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_version_number_check" CHECK ("survey"."version_number" >= 1);--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_previous_version_check" CHECK ("survey"."previous_version_id" is null or "survey"."previous_version_id" <> "survey"."survey_id");
