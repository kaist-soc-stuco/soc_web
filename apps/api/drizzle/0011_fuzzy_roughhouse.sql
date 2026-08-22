CREATE TABLE "article_engagement" (
	"article_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_engagement_article_id_user_id_kind_pk" PRIMARY KEY("article_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "article_view" (
	"article_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_view_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "is_secret" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "article_engagement" ADD CONSTRAINT "article_engagement_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_engagement" ADD CONSTRAINT "article_engagement_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_view" ADD CONSTRAINT "article_view_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_view" ADD CONSTRAINT "article_view_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_engagement_user_kind_idx" ON "article_engagement" USING btree ("user_id","kind","updated_at");--> statement-breakpoint
CREATE INDEX "article_view_user_idx" ON "article_view" USING btree ("user_id","created_at");