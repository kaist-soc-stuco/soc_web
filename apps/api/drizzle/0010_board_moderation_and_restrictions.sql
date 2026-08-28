ALTER TABLE "board"
  ADD COLUMN IF NOT EXISTS "write_access_type" varchar(20) DEFAULT 'AUTHENTICATED' NOT NULL;
--> statement-breakpoint
UPDATE "board"
SET "write_access_type" = 'PERMISSION'
WHERE "write_permission_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "article"
  ADD COLUMN IF NOT EXISTS "is_official" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "comment"
  ADD COLUMN IF NOT EXISTS "moderation_reason" text;
--> statement-breakpoint
ALTER TABLE "comment"
  ADD COLUMN IF NOT EXISTS "moderated_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "comment"
  ADD COLUMN IF NOT EXISTS "moderated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "comment"
  ADD CONSTRAINT "comment_moderated_by_user_id_users_user_id_fk"
  FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("user_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_article_status_created_idx"
  ON "comment" USING btree ("article_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_moderated_by_idx"
  ON "comment" USING btree ("moderated_by_user_id", "moderated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_restriction" (
  "restriction_id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "duration" varchar(20) NOT NULL,
  "expires_at" timestamp with time zone,
  "reason_code" varchar(40) NOT NULL,
  "reason_detail" text,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "user_restriction"
  ADD CONSTRAINT "user_restriction_user_id_users_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_restriction"
  ADD CONSTRAINT "user_restriction_created_by_user_id_users_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_restriction"
  ADD CONSTRAINT "user_restriction_revoked_by_user_id_users_user_id_fk"
  FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("user_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_restriction_active_idx"
  ON "user_restriction" USING btree ("user_id", "revoked_at", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_restriction_created_by_idx"
  ON "user_restriction" USING btree ("created_by_user_id", "created_at");
