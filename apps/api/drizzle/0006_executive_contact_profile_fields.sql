ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "department_ko" varchar(100);
--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "department_en" varchar(100);
--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "avatar_storage_key" varchar(255);
