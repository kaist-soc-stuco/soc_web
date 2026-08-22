CREATE TABLE "calendar_event" (
	"calendar_event_id" serial PRIMARY KEY NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location" varchar(255),
	"source_uid" varchar(255),
	"source_type" varchar(20) DEFAULT 'MANUAL' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_created_by_user_id_users_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_event_range_idx" ON "calendar_event" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "calendar_event_source_uid_idx" ON "calendar_event" USING btree ("source_uid");