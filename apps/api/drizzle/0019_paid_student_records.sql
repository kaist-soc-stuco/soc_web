CREATE TABLE "paid_student_records" (
	"std_no" varchar(8) PRIMARY KEY NOT NULL,
	"name_ko" varchar(100),
	"admission_year" integer,
	"paid_semesters" smallint NOT NULL,
	"paid_amount" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
