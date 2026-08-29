ALTER TABLE "calendar_event" ADD COLUMN "is_all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "is_always" boolean DEFAULT false NOT NULL;