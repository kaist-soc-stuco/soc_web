CREATE TABLE "roadmap_course_relation" (
	"relation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prerequisite_course_id" uuid NOT NULL,
	"postrequisite_course_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_course" (
	"course_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_code" varchar(64) NOT NULL,
	"legacy_course_code" varchar(64),
	"name_ko" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"category" varchar(32) DEFAULT 'major-elective' NOT NULL,
	"credits" varchar(40) DEFAULT '' NOT NULL,
	"semesters" varchar(20) DEFAULT 'S/F' NOT NULL,
	"track_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai" boolean DEFAULT false NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"source" varchar(20) DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_term" (
	"term_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(32) NOT NULL,
	"source_file_name" varchar(255),
	"imported_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap_course_relation" ADD CONSTRAINT "roadmap_course_relation_prerequisite_course_id_roadmap_course_course_id_fk" FOREIGN KEY ("prerequisite_course_id") REFERENCES "public"."roadmap_course"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_course_relation" ADD CONSTRAINT "roadmap_course_relation_postrequisite_course_id_roadmap_course_course_id_fk" FOREIGN KEY ("postrequisite_course_id") REFERENCES "public"."roadmap_course"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_term" ADD CONSTRAINT "roadmap_term_imported_by_users_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_course_relation_pair_uq" ON "roadmap_course_relation" USING btree ("prerequisite_course_id","postrequisite_course_id");--> statement-breakpoint
CREATE INDEX "roadmap_course_relation_target_idx" ON "roadmap_course_relation" USING btree ("postrequisite_course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_course_code_uq" ON "roadmap_course" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "roadmap_course_legacy_code_idx" ON "roadmap_course" USING btree ("legacy_course_code");--> statement-breakpoint
CREATE INDEX "roadmap_course_visible_idx" ON "roadmap_course" USING btree ("is_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_term_term_uq" ON "roadmap_term" USING btree ("term");--> statement-breakpoint
CREATE INDEX "roadmap_term_imported_idx" ON "roadmap_term" USING btree ("imported_at");