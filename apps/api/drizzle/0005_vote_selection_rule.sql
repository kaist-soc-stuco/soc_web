ALTER TABLE "vote_item" ADD COLUMN "selection_rule" text DEFAULT 'max' NOT NULL;
ALTER TABLE "vote_item" ADD CONSTRAINT "vote_item_selection_rule_check" CHECK ("selection_rule" IN ('max', 'min', 'exact'));
