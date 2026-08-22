ALTER TABLE "executive_contact" ADD COLUMN "gender" varchar(20);--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "cohort" integer;--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "privacy_consented" boolean DEFAULT true NOT NULL;