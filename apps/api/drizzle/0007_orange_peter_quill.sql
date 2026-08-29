ALTER TABLE "executive_contact_department" ADD COLUMN "description_ko" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact_department" ADD COLUMN "description_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact_department" ADD COLUMN "inquiry_email" varchar(255) DEFAULT '' NOT NULL;