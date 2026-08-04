CREATE INDEX "survey_responses_review_queue_idx" ON "survey_responses" USING btree ("survey_id","state","submitted_at" DESC,"id" DESC);
