-- Phase 2 PII contract gate: verify durable backfill completion before enforcement.
DO $$
DECLARE
  incomplete boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM "user_pii_backfill_progress"
    WHERE job_key = 'users' AND completed_at IS NOT NULL
  ) INTO incomplete;
  IF incomplete AND NOT EXISTS (
    SELECT 1
    FROM "users"
    WHERE kaist_uid IS NOT NULL
       OR student_or_employee_number IS NOT NULL
       OR name_kr IS NOT NULL
       OR name_en IS NOT NULL
       OR user_email IS NOT NULL
       OR user_mobile IS NOT NULL
  ) THEN
    INSERT INTO "user_pii_backfill_progress" ("job_key", "completed_at")
    VALUES ('users', now())
    ON CONFLICT ("job_key") DO UPDATE SET "completed_at" = COALESCE("user_pii_backfill_progress"."completed_at", EXCLUDED."completed_at");
    incomplete := false;
  END IF;
  IF incomplete THEN
    RAISE EXCEPTION 'users PII backfill must be completed before encrypted-only enforcement';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "users"
    WHERE (kaist_uid IS NOT NULL AND kaist_uid !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
       OR (student_or_employee_number IS NOT NULL AND student_or_employee_number !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
       OR (name_kr IS NOT NULL AND name_kr !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
       OR (name_en IS NOT NULL AND name_en !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
       OR (user_email IS NOT NULL AND user_email !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
       OR (user_mobile IS NOT NULL AND user_mobile !~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$')
  ) THEN
    RAISE EXCEPTION 'users contain plaintext or unknown PII envelopes';
  END IF;
END $$;

DROP TRIGGER IF EXISTS "users_reject_new_invalid_pii_envelope" ON "users";
CREATE TRIGGER "users_reject_new_invalid_pii_envelope" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "public"."users_reject_new_invalid_pii_envelope"();
