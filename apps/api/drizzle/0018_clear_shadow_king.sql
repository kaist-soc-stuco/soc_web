ALTER TABLE "bulk_email" ADD COLUMN "content_type" varchar(10) DEFAULT 'html' NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "recipient_type" varchar(30) DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "recipient_filters" jsonb;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "attachment_asset_ids" jsonb;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "error_message" text;--> statement-breakpoint
CREATE INDEX "bulk_email_scheduled_idx" ON "bulk_email" USING btree ("status","scheduled_at");