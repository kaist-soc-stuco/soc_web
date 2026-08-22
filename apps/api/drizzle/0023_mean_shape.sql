CREATE TYPE "public"."content_block_status" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."content_block_type" AS ENUM('HERO', 'TOP_BANNER', 'POPUP', 'STATUS_NOTICE', 'QUICK_LINK');--> statement-breakpoint
CREATE TABLE "content_block" (
	"content_block_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_block_type" NOT NULL,
	"status" "content_block_status" DEFAULT 'DRAFT' NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255) DEFAULT '' NOT NULL,
	"body_ko" text,
	"body_en" text,
	"link_url" varchar(2000),
	"image_url" varchar(2000),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_published_by_users_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_block_status_order_idx" ON "content_block" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "content_block_type_order_idx" ON "content_block" USING btree ("type","sort_order");--> statement-breakpoint
CREATE INDEX "content_block_schedule_idx" ON "content_block" USING btree ("starts_at","ends_at");