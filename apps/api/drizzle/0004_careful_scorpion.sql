ALTER TABLE "survey_responses" ADD COLUMN "single_response_user_id" uuid;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_single_response_user_id_users_user_id_fk" FOREIGN KEY ("single_response_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "survey_responses" AS "response"
SET "single_response_user_id" = "response"."user_id"
FROM "survey"
WHERE "response"."survey_id" = "survey"."survey_id"
  AND "survey"."allow_multiple_responses" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_single_response_user_unique_idx" ON "survey_responses" USING btree ("survey_id","single_response_user_id");
