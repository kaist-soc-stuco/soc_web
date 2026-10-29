CREATE TABLE "student_fee_consent" (
	"user_id" uuid NOT NULL,
	"semester" varchar(6) NOT NULL,
	"notice_version" varchar(40) NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "student_fee_consent_user_id_semester_pk" PRIMARY KEY("user_id","semester")
);
--> statement-breakpoint
ALTER TABLE "paid_student_records" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD COLUMN "initial_paid_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_fee_consent" ADD CONSTRAINT "student_fee_consent_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Preserve historical summaries as a baseline only where there is no ledger.
-- With a ledger, the old summary held the latest payment, not an extra receipt.
UPDATE "student_fee_status" s SET "initial_paid_amount" = greatest(s."paid_amount", 0)
WHERE NOT EXISTS (SELECT 1 FROM "student_fee_payment" p WHERE p."user_id" = s."user_id");
--> statement-breakpoint
-- An old, recognized completion survives later price changes and calendar years.
UPDATE "paid_student_records" r SET "completed_at" = r."updated_at"
WHERE r."paid_semesters" >= 6 OR EXISTS (
  SELECT 1 FROM "users" u JOIN "student_fee_status" s ON s."user_id" = u."user_id"
  WHERE u."std_no" = r."std_no" AND s."status" = 'PAID'
);
