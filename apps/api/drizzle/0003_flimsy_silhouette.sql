CREATE TYPE "public"."event_visibility" AS ENUM('PUBLIC', 'AUTHENTICATED', 'COMMITTEE');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	"description_kr" text NOT NULL,
	"description_en" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"all_day_start_date" date,
	"all_day_end_date" date,
	"location" text NOT NULL,
	"visibility" "event_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_title_kr_nonempty" CHECK (btrim("events"."title_kr") <> ''),
	CONSTRAINT "events_title_en_nonempty" CHECK (btrim("events"."title_en") <> ''),
	CONSTRAINT "events_description_kr_nonempty" CHECK (btrim("events"."description_kr") <> ''),
	CONSTRAINT "events_description_en_nonempty" CHECK (btrim("events"."description_en") <> ''),
	CONSTRAINT "events_location_nonempty" CHECK (btrim("events"."location") <> ''),
	CONSTRAINT "events_time_order" CHECK ("events"."end_at" > "events"."start_at"),
	CONSTRAINT "events_all_day_dates" CHECK (("events"."all_day" = false AND "events"."all_day_start_date" IS NULL AND "events"."all_day_end_date" IS NULL) OR ("events"."all_day" = true AND "events"."all_day_start_date" IS NOT NULL AND "events"."all_day_end_date" IS NOT NULL AND "events"."all_day_end_date" > "events"."all_day_start_date"))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_range_idx" ON "events" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "events_visibility_range_idx" ON "events" USING btree ("visibility","start_at","end_at");
--> statement-breakpoint
INSERT INTO "permission_definitions" ("key", "description")
VALUES ('EVENT_MANAGE', 'Manage calendar events')
ON CONFLICT ("key") DO NOTHING;