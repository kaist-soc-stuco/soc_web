CREATE TABLE "roadmap_offering" (
	"offering_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(32) NOT NULL,
	"course_code" varchar(64) NOT NULL,
	"current_code" varchar(64) NOT NULL,
	"name_ko" text NOT NULL,
	"section" varchar(30),
	"instructor" text,
	"credits" varchar(40),
	"time" text,
	"room" text,
	"capacity" integer,
	"enrolled" integer,
	"delivery" varchar(80),
	"in_english" boolean DEFAULT false NOT NULL,
	"source_data" jsonb NOT NULL,
	"source_file_name" varchar(255),
	"imported_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap_offering" ADD CONSTRAINT "roadmap_offering_imported_by_users_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roadmap_offering_term_idx" ON "roadmap_offering" USING btree ("term");--> statement-breakpoint
CREATE INDEX "roadmap_offering_course_idx" ON "roadmap_offering" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "roadmap_offering_import_idx" ON "roadmap_offering" USING btree ("imported_at");