CREATE TABLE "student_fee_google_sheets_integration" (
	"integration_key" varchar(40) PRIMARY KEY NOT NULL,
	"spreadsheet_id" varchar(255) NOT NULL,
	"spreadsheet_url" varchar(2000) NOT NULL,
	"created_by" uuid,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_fee_google_sheets_integration" ADD CONSTRAINT "student_fee_google_sheets_integration_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
