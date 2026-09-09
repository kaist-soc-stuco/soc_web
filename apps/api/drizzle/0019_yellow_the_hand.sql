ALTER TABLE "asset" ADD COLUMN "upload_status" varchar(16) DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "upload_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "asset_upload_status_expiry_idx" ON "asset" USING btree ("upload_status","upload_expires_at");