CREATE TABLE "comment_engagement" (
	"comment_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_engagement_comment_id_user_id_kind_pk" PRIMARY KEY("comment_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "comment_report" (
	"report_id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"reason" varchar(500),
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comment_engagement" ADD CONSTRAINT "comment_engagement_comment_id_comment_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_engagement" ADD CONSTRAINT "comment_engagement_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_comment_id_comment_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_reporter_user_id_users_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_engagement_user_kind_idx" ON "comment_engagement" USING btree ("user_id","kind","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_report_comment_reporter_idx" ON "comment_report" USING btree ("comment_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "comment_report_status_created_idx" ON "comment_report" USING btree ("status","created_at");