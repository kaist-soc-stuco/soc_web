CREATE TABLE "asset_cleanup_lease" (
	"lease_name" varchar(64) PRIMARY KEY NOT NULL,
	"owner_token" varchar(64) NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_email_delivery_attempt" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" varchar(120)
);
--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "claim_token" varchar(64);--> statement-breakpoint
ALTER TABLE "google_spreadsheet_sync_job" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "google_spreadsheet_sync_job" ADD COLUMN "claim_token" varchar(64);--> statement-breakpoint
ALTER TABLE "bulk_email_delivery_attempt" ADD CONSTRAINT "bulk_email_delivery_attempt_email_id_bulk_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."bulk_email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_email_delivery_attempt_email_number_idx" ON "bulk_email_delivery_attempt" USING btree ("email_id","attempt_number");--> statement-breakpoint
CREATE INDEX "bulk_email_delivery_attempt_email_idx" ON "bulk_email_delivery_attempt" USING btree ("email_id","started_at");