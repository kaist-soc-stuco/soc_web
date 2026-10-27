-- Gender is no longer collected or used by the service.
-- Keep the nullable column for compatibility while removing existing values.
UPDATE "users" SET "gender" = NULL WHERE "gender" IS NOT NULL;
