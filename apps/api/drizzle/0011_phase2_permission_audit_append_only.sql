CREATE OR REPLACE FUNCTION permission_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'permission_audit_log is append-only' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER permission_audit_log_append_only_trigger
BEFORE UPDATE OR DELETE ON permission_audit_log
FOR EACH ROW
EXECUTE FUNCTION permission_audit_log_append_only();
