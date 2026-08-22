CREATE TABLE "article_draft" (
	"draft_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"board_id" integer NOT NULL,
	"target_article_id" integer,
	"title_ko" varchar(255) DEFAULT '' NOT NULL,
	"title_en" varchar(255),
	"content_ko" text DEFAULT '' NOT NULL,
	"content_en" text,
	"fingerprint" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_owner_user_id_users_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_board_id_board_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_target_article_id_article_article_id_fk" FOREIGN KEY ("target_article_id") REFERENCES "public"."article"("article_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_draft_owner_updated_idx" ON "article_draft" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "article_draft_board_updated_idx" ON "article_draft" USING btree ("board_id","updated_at");