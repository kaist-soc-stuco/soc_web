-- Phase 2 permission transition and deterministic users cursor repair.
DO $$
BEGIN
  UPDATE "users"
  SET "created_at" = COALESCE("created_at", TIMESTAMPTZ '1970-01-01 UTC' + (('x' || substr(md5("id"::text), 1, 12))::bit(48)::bigint * interval '1 microsecond'))
  WHERE "created_at" IS NULL;

  ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION "public"."permission_change_requests_enforce_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.target_user_id IS DISTINCT FROM OLD.target_user_id
     OR NEW.action IS DISTINCT FROM OLD.action
     OR NEW.requested_reason_code IS DISTINCT FROM OLD.requested_reason_code
     OR NEW.permission_definition_id IS DISTINCT FROM OLD.permission_definition_id
     OR NEW.scope IS DISTINCT FROM OLD.scope
     OR NEW.scope_id IS DISTINCT FROM OLD.scope_id
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'permission change request payload is immutable';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'PENDING' AND NEW.status = 'APPROVED' THEN
    IF NEW.expires_at <= now() THEN
      RAISE EXCEPTION 'permission change request is expired';
    END IF;
    IF NEW.approver_user_id IS NULL OR NEW.approval_reason_code IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'approval metadata is required';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'APPROVED' AND NEW.status = 'ACTIVATED' THEN
    IF NEW.expires_at <= now() THEN
      RAISE EXCEPTION 'permission change request is expired';
    END IF;
    IF NEW.activator_user_id IS NULL OR NEW.activation_reason_code IS NULL OR NEW.activated_at IS NULL THEN
      RAISE EXCEPTION 'activation metadata is required';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'EXPIRED' AND OLD.status IN ('PENDING', 'APPROVED') THEN
    IF NEW.expires_at >= now() THEN
      RAISE EXCEPTION 'permission change request can expire only after expires_at is past';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid permission change request transition';
END;
$fn$;

DROP TRIGGER IF EXISTS "permission_change_requests_enforce_transition" ON "permission_change_requests";
CREATE TRIGGER "permission_change_requests_enforce_transition"
BEFORE UPDATE ON "permission_change_requests"
FOR EACH ROW
EXECUTE FUNCTION "public"."permission_change_requests_enforce_transition"();
