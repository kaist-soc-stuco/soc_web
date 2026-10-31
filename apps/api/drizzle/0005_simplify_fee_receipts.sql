-- Historical balances become ledger entries without inventing a payment date.
-- INITIAL_RECORD is excluded from date-based cash receipts statistics.
ALTER TABLE "student_fee_payment" DROP COLUMN "payment_method";
--> statement-breakpoint
INSERT INTO "student_fee_payment" ("user_id", "std_no", "amount", "payment_type", "effective_start_semester", "coverage_semesters", "paid_at", "note", "created_at", "updated_at")
SELECT (SELECT u."user_id" FROM "users" u WHERE u."std_no" = r."std_no" ORDER BY u."created_at" LIMIT 1),
  r."std_no", r."paid_amount", 'INITIAL_RECORD',
  to_char(r."imported_at" AT TIME ZONE 'Asia/Seoul', 'YYYY') || CASE WHEN extract(month FROM r."imported_at" AT TIME ZONE 'Asia/Seoul') <= 6 THEN '-1' ELSE '-2' END,
  6, r."imported_at", '기초자료', r."imported_at", now()
FROM "paid_student_records" r WHERE r."paid_amount" > 0;
--> statement-breakpoint
INSERT INTO "student_fee_payment" ("user_id", "amount", "payment_type", "effective_start_semester", "coverage_semesters", "paid_at", "note")
SELECT s."user_id",
  CASE WHEN EXISTS (SELECT 1 FROM "student_fee_payment" p WHERE p."user_id" = s."user_id") THEN s."initial_paid_amount" ELSE greatest(s."initial_paid_amount", s."paid_amount") END,
  'INITIAL_RECORD', to_char(s."updated_at" AT TIME ZONE 'Asia/Seoul', 'YYYY') || CASE WHEN extract(month FROM s."updated_at" AT TIME ZONE 'Asia/Seoul') <= 6 THEN '-1' ELSE '-2' END,
  6, coalesce(s."paid_at", s."updated_at"), '기초자료'
FROM "student_fee_status" s JOIN "users" u ON u."user_id" = s."user_id"
WHERE NOT EXISTS (SELECT 1 FROM "paid_student_records" r WHERE r."std_no" = u."std_no")
  AND CASE WHEN EXISTS (SELECT 1 FROM "student_fee_payment" p WHERE p."user_id" = s."user_id") THEN s."initial_paid_amount" ELSE greatest(s."initial_paid_amount", s."paid_amount") END > 0;
--> statement-breakpoint
UPDATE "paid_student_records" SET "paid_amount" = 0, "updated_at" = now() WHERE "paid_amount" <> 0;
--> statement-breakpoint
UPDATE "student_fee_status" SET "initial_paid_amount" = 0, "updated_at" = now() WHERE "initial_paid_amount" <> 0;
