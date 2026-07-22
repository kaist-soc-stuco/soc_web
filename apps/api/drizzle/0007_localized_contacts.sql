UPDATE "executive_contact"
SET "name_en" = "name_ko"
WHERE "name_en" IS NULL OR btrim("name_en") = '';--> statement-breakpoint
UPDATE "executive_contact"
SET "role_en" = "role_ko"
WHERE "role_en" IS NULL OR btrim("role_en") = '';--> statement-breakpoint
ALTER TABLE "executive_contact" ALTER COLUMN "name_en" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact" ALTER COLUMN "role_en" SET NOT NULL;
