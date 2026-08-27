CREATE TABLE IF NOT EXISTS "user_sanction" (
  "sanction_id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(40) DEFAULT 'POSTING_SUSPENDED' NOT NULL,
  "reason" text NOT NULL,
  "issued_by" uuid,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_sanction_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "user_sanction_issued_by_users_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "user_sanction_revoked_by_users_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sanction_active_idx" ON "user_sanction" USING btree ("user_id", "type", "revoked_at");
