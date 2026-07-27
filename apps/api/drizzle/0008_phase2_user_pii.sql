CREATE TABLE IF NOT EXISTS "user_pii_backfill_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_key" text NOT NULL UNIQUE,
  "last_processed_created_at" timestamptz,
  "last_processed_user_id" uuid REFERENCES "public"."users"("id"),
  "upper_bound_created_at" timestamptz,
  "upper_bound_user_id" uuid REFERENCES "public"."users"("id"),
  "batch_size" integer NOT NULL DEFAULT 500,
  "completed_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_pii_backfill_progress_cursor_idx" ON "user_pii_backfill_progress" ("last_processed_created_at", "last_processed_user_id");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_reject_new_invalid_pii_envelope') THEN
    CREATE OR REPLACE FUNCTION "public"."users_reject_new_invalid_pii_envelope"() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE field_name text; field_value text;
    BEGIN
      FOREACH field_name IN ARRAY ARRAY['kaist_uid','student_or_employee_number','name_kr','name_en','user_email','user_mobile'] LOOP
        field_value := to_jsonb(NEW)->>field_name;
        IF field_value IS NOT NULL AND (TG_OP = 'INSERT' OR field_value IS DISTINCT FROM (to_jsonb(OLD)->>field_name)) AND field_value !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$' THEN
          RAISE EXCEPTION 'users.% must be an encryption envelope', field_name;
        END IF;
      END LOOP;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER "users_reject_new_invalid_pii_envelope" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "public"."users_reject_new_invalid_pii_envelope"();
  END IF;
END $$;