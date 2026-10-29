ALTER TABLE "student_fee_payment" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD COLUMN "std_no" varchar(8);--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_std_no_paid_student_records_std_no_fk" FOREIGN KEY ("std_no") REFERENCES "public"."paid_student_records"("std_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_fee_payment_std_no_idx" ON "student_fee_payment" USING btree ("std_no","paid_at");--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_person_required" CHECK ("student_fee_payment"."user_id" IS NOT NULL OR "student_fee_payment"."std_no" IS NOT NULL);