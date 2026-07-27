CREATE TYPE "public"."faq_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "faq_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	"display_order" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_topics_title_kr_nonempty" CHECK (btrim("faq_topics"."title_kr") <> ''),
	CONSTRAINT "faq_topics_title_en_nonempty" CHECK (btrim("faq_topics"."title_en") <> ''),
	CONSTRAINT "faq_topics_display_order_nonnegative" CHECK ("faq_topics"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"question_kr" text NOT NULL,
	"question_en" text NOT NULL,
	"answer_kr" text NOT NULL,
	"answer_en" text NOT NULL,
	"display_order" integer NOT NULL,
	"status" "faq_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_question_kr_nonempty" CHECK (btrim("faqs"."question_kr") <> ''),
	CONSTRAINT "faqs_question_en_nonempty" CHECK (btrim("faqs"."question_en") <> ''),
	CONSTRAINT "faqs_answer_kr_nonempty" CHECK (btrim("faqs"."answer_kr") <> ''),
	CONSTRAINT "faqs_answer_en_nonempty" CHECK (btrim("faqs"."answer_en") <> ''),
	CONSTRAINT "faqs_display_order_nonnegative" CHECK ("faqs"."display_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "faq_topics" ADD CONSTRAINT "faq_topics_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_topics" ADD CONSTRAINT "faq_topics_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_topic_id_faq_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."faq_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "faq_topics_display_order_unique" ON "faq_topics" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "faqs_topic_display_order_unique" ON "faqs" USING btree ("topic_id","display_order");--> statement-breakpoint
CREATE INDEX "faqs_public_list_idx" ON "faqs" USING btree ("status","topic_id","display_order");
--> statement-breakpoint
INSERT INTO "permission_definitions" ("key", "description")
VALUES ('FAQ_MANAGE', 'Manage FAQ topics and entries')
ON CONFLICT ("key") DO NOTHING;