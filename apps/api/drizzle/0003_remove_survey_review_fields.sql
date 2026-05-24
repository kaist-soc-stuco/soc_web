UPDATE "survey_responses"
SET "status" = 'submitted'
WHERE "status" IS DISTINCT FROM 'submitted';

ALTER TABLE "survey_responses" ALTER COLUMN "status" SET DEFAULT 'submitted';
ALTER TABLE "survey_responses" DROP COLUMN "reviewed_at";
ALTER TABLE "survey_responses" DROP COLUMN "review_admin_id";
ALTER TABLE "survey_responses" DROP COLUMN "review_reason";