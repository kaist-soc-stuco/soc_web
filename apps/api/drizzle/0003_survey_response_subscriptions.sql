CREATE TABLE "survey_response_subscription" (
  "survey_id" uuid NOT NULL REFERENCES "survey"("survey_id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "survey_response_subscription_unique" ON "survey_response_subscription" ("survey_id", "user_id");
