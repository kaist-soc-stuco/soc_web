ALTER TABLE "users" ADD COLUMN "student_or_employee_kind" text;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_student_or_employee_kind_valid" CHECK ("student_or_employee_kind" IS NULL OR "student_or_employee_kind" IN ('STUDENT', 'EMPLOYEE'));
