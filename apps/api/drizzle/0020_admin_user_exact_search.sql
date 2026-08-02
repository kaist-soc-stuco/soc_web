DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    WHERE (student_or_employee_number IS NOT NULL AND octet_length(student_or_employee_number) > 246)
       OR (name_kr IS NOT NULL AND octet_length(name_kr) > 246)
       OR (name_en IS NOT NULL AND octet_length(name_en) > 246)
  ) THEN
    RAISE EXCEPTION 'user searchable encryption envelope exceeds 246 bytes';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX "users_student_or_employee_number_idx" ON "users" USING btree ("student_or_employee_number");
--> statement-breakpoint
CREATE INDEX "users_name_kr_idx" ON "users" USING btree ("name_kr");
--> statement-breakpoint
CREATE INDEX "users_name_en_idx" ON "users" USING btree ("name_en");
