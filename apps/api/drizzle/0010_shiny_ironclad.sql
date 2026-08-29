CREATE TABLE "google_spreadsheet_sync_job" (
	"google_spreadsheet_sync_job_id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_key" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_spreadsheet_sync_job_status_check" CHECK ("google_spreadsheet_sync_job"."status" in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
	CONSTRAINT "google_spreadsheet_sync_job_revision_check" CHECK ("google_spreadsheet_sync_job"."revision" >= 1),
	CONSTRAINT "google_spreadsheet_sync_job_attempts_check" CHECK ("google_spreadsheet_sync_job"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "google_spreadsheet_sync_job_due_idx" ON "google_spreadsheet_sync_job" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_spreadsheet_sync_job_resource_idx" ON "google_spreadsheet_sync_job" USING btree ("resource_type","resource_key");