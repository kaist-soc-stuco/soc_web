CREATE TABLE "student_fee_payment" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"payment_type" varchar(40) NOT NULL,
	"payment_method" varchar(30) NOT NULL,
	"effective_start_semester" varchar(7) NOT NULL,
	"coverage_semesters" smallint DEFAULT 6 NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_fee_status" ALTER COLUMN "coverage_semesters" SET DEFAULT 6;--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_recorded_by_users_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_fee_payment_user_paid_idx" ON "student_fee_payment" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "student_fee_payment_semester_idx" ON "student_fee_payment" USING btree ("effective_start_semester");