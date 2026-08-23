ALTER TABLE "calendar_event" ADD COLUMN "is_hidden_by_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "category_override" varchar(20);--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "override_updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "override_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_override_updated_by_user_id_users_user_id_fk" FOREIGN KEY ("override_updated_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;