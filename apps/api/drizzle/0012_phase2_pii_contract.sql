-- Phase 2 PII contract: enforce envelope format after expand/backfill.
DO $$ BEGIN
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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_reject_new_invalid_pii_envelope') THEN
    CREATE TRIGGER "users_reject_new_invalid_pii_envelope" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "public"."users_reject_new_invalid_pii_envelope"();
  END IF;
END $$;
