ALTER TABLE "surveys" ADD COLUMN "definition_version" integer NOT NULL DEFAULT 1;
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_definition_version_positive" CHECK ("definition_version" > 0);
