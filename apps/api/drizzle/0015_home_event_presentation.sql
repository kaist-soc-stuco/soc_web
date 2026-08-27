ALTER TABLE "article"
  ADD COLUMN IF NOT EXISTS "home_visible" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "article"
  ADD COLUMN IF NOT EXISTS "home_order" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_home_presentation_idx"
  ON "article" USING btree ("home_visible", "home_order", "event_start_date");
