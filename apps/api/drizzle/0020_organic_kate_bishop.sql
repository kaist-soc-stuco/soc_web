CREATE TABLE "calendar_sync_job" (
	"calendar_sync_job_id" serial PRIMARY KEY NOT NULL,
	"calendar_event_id" integer NOT NULL,
	"target_calendar_id" varchar(255) NOT NULL,
	"operation" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_event" ALTER COLUMN "source_type" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "calendar_event" ALTER COLUMN "source_type" SET DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE "calendar_event" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "source_year" integer;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "is_read_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_calendar_id" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_etag" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_sync_status" varchar(20) DEFAULT 'NOT_CONFIGURED' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "google_sync_error" text;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_calendar_event_id_calendar_event_calendar_event_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_event"("calendar_event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_sync_job_due_idx" ON "calendar_sync_job" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_target_event_idx" ON "calendar_sync_job" USING btree ("calendar_event_id","target_calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_event_source_year_idx" ON "calendar_event" USING btree ("source_type","source_year");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_source_identity_idx" ON "calendar_event" USING btree ("source_type","source_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_google_identity_idx" ON "calendar_event" USING btree ("google_calendar_id","google_event_id");