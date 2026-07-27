ALTER TABLE "permission_audit_log" ADD COLUMN IF NOT EXISTS "request_fingerprint" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permission_audit_log_request_fingerprint_check'
      AND conrelid = 'permission_audit_log'::regclass
  ) THEN
    ALTER TABLE "permission_audit_log"
      ADD CONSTRAINT "permission_audit_log_request_fingerprint_check"
      CHECK ("request_fingerprint" IS NULL OR "request_fingerprint" ~ '^[0-9a-f]{64}$');
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permission_audit_log_fee_idempotency_unique"
  ON "permission_audit_log" USING btree ("actor_user_id", "correlation_id")
  WHERE "action" = 'FEE_STATUS_UPDATED';
