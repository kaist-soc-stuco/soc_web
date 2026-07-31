ALTER TABLE "survey_sections" ADD COLUMN "description_kr" text;
ALTER TABLE "survey_sections" ADD COLUMN "description_en" text;
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_description_pair" CHECK (("description_kr" IS NULL) = ("description_en" IS NULL));
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_description_kr_nonblank" CHECK ("description_kr" IS NULL OR btrim("description_kr") <> '\);
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_description_en_nonblank" CHECK ("description_en" IS NULL OR btrim("description_en") <> '\);
