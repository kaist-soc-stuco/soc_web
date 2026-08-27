ALTER TABLE "article" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "hidden_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "hidden_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_hidden_by_user_id_users_user_id_fk" FOREIGN KEY ("hidden_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;