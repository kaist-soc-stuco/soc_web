-- Phase 2 PII contract gate: verify durable backfill completion before enforcement.
DO $$
DECLARE
  incomplete boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM "user_pii_backfill_progress"
    WHERE job_key = 'users' AND completed_at IS NOT NULL
  ) INTO incomplete;
  IF incomplete THEN
    RAISE EXCEPTION 'users PII backfill must be completed before encrypted-only enforcement';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "users"
    WHERE kaist_uid LIKE 'enc:%' AND kaist_uid !~ '^enc:v1:'
       OR student_or_employee_number LIKE 'enc:%' AND student_or_employee_number !~ '^enc:v1:'
       OR name_kr LIKE 'enc:%' AND name_kr !~ '^enc:v1:'
       OR name_en LIKE 'enc:%' AND name_en !~ '^enc:v1:'
       OR user_email LIKE 'enc:%' AND user_email !~ '^enc:v1:'
       OR user_mobile LIKE 'enc:%' AND user_mobile !~ '^enc:v1:'
       OR (kaist_uid IS NOT NULL AND kaist_uid !~ '^enc:v1:')
       OR (student_or_employee_number IS NOT NULL AND student_or_employee_number !~ '^enc:v1:')
       OR (name_kr IS NOT NULL AND name_kr !~ '^enc:v1:')
       OR (name_en IS NOT NULL AND name_en !~ '^enc:v1:')
       OR (user_email IS NOT NULL AND user_email !~ '^enc:v1:')
       OR (user_mobile IS NOT NULL AND user_mobile !~ '^enc:v1:')
  ) THEN
    RAISE EXCEPTION 'users contain plaintext or unknown PII envelopes';
  END IF;
END $$;

DROP TRIGGER IF EXISTS "users_reject_new_invalid_pii_envelope" ON "users";
CREATE TRIGGER "users_reject_new_invalid_pii_envelope" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "public"."users_reject_new_invalid_pii_envelope"();
