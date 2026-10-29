ALTER TABLE "paid_student_records" ADD COLUMN "note" text;
--> statement-breakpoint
INSERT INTO "permission" ("permission_id", "code", "bit_value", "name_ko", "name_en", "description") VALUES
  (65536, 'VIEW_FINANCE', 65536, '과비 명부 조회', 'View student fees', '학생회비 납부 명부와 납부 내역·통계를 조회할 수 있습니다.'),
  (131072, 'EXPORT_FINANCE', 131072, '과비 명부 내보내기', 'Export student fees', '학생회비 납부 명부와 납부 내역을 파일로 내려받을 수 있습니다.')
ON CONFLICT ("code") DO UPDATE SET "name_ko" = EXCLUDED."name_ko", "name_en" = EXCLUDED."name_en", "description" = EXCLUDED."description";
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT existing."role_group_id", added."permission_id"
FROM "role_group_permission" existing
JOIN "permission" finance ON finance."permission_id" = existing."permission_id" AND finance."code" = 'MANAGE_FINANCE'
CROSS JOIN "permission" added
WHERE added."code" IN ('VIEW_FINANCE', 'EXPORT_FINANCE')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "google_spreadsheet_sync_job" SET "status" = 'FAILED', "last_error" = 'google_sheets_retired', "locked_at" = NULL, "lease_until" = NULL, "claim_token" = NULL, "updated_at" = now()
WHERE "status" IN ('PENDING', 'PROCESSING');
