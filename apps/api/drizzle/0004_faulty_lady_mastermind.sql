CREATE TABLE "executive_contact_department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100) DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "student_number" varchar(30);--> statement-breakpoint
CREATE UNIQUE INDEX "executive_contact_department_name_ko_uq" ON "executive_contact_department" USING btree ("name_ko");--> statement-breakpoint
CREATE INDEX "executive_contact_department_sort_idx" ON "executive_contact_department" USING btree ("sort_order");