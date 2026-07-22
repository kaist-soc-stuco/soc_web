CREATE TYPE "public"."site_content_key" AS ENUM('home.hero.title', 'home.hero.description', 'home.hero.cta', 'about.hero.description', 'about.intro.title', 'about.intro.body', 'about.roadmap.title', 'about.roadmap.description', 'footer.description', 'footer.contact');--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" "site_content_key" PRIMARY KEY NOT NULL,
	"value_ko" text NOT NULL,
	"value_en" text NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
