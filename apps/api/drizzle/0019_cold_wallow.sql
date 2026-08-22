CREATE TABLE "bulk_email_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255) DEFAULT '' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(10) DEFAULT 'html' NOT NULL,
	"recipient_type" varchar(30) DEFAULT 'ALL' NOT NULL,
	"recipient_filters" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bulk_email" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "bulk_email_template" ADD CONSTRAINT "bulk_email_template_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bulk_email_template_updated_idx" ON "bulk_email_template" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "bulk_email_template_creator_idx" ON "bulk_email_template" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_email_idempotency_unique" ON "bulk_email" USING btree ("sender_id","idempotency_key");