ALTER TABLE "comment" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "hidden_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_hidden_by_user_id_users_user_id_fk" FOREIGN KEY ("hidden_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;