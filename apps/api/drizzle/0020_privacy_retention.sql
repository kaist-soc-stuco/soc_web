CREATE TABLE "privacy_retention_case" (
	"kind" varchar(20) NOT NULL,
	"resource_id" uuid NOT NULL,
	"source_version" text NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"hold_until" timestamp with time zone,
	"hold_reason" varchar(300),
	"completed_at" timestamp with time zone,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_retention_case_kind_resource_id_pk" PRIMARY KEY("kind","resource_id"),
	CONSTRAINT "privacy_retention_kind_check" CHECK ("privacy_retention_case"."kind" in ('SURVEY', 'APPLICATION', 'VOTE', 'FEE_PAYMENT', 'CONTACT')),
	CONSTRAINT "privacy_retention_dates_check" CHECK ("privacy_retention_case"."expires_at" >= "privacy_retention_case"."finalized_at"),
	CONSTRAINT "privacy_retention_hold_check" CHECK ("privacy_retention_case"."hold_until" is null or "privacy_retention_case"."hold_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "privacy_retention_case" ADD CONSTRAINT "privacy_retention_case_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "privacy_retention_due_idx" ON "privacy_retention_case" USING btree ("completed_at","expires_at");