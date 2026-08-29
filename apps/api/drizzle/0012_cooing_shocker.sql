ALTER TABLE "board" ADD COLUMN "write_access_scope" varchar(30) DEFAULT 'ANYONE' NOT NULL;
--> statement-breakpoint
UPDATE "board"
SET "write_access_scope" = CASE
  WHEN "write_permission_id" IS NULL THEN 'AUTHENTICATED'
  ELSE 'PERMISSION'
END;
