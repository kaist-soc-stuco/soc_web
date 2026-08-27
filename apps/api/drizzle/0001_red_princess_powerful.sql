ALTER TABLE "survey" ALTER COLUMN "eligible_soc_affiliations" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "survey" ALTER COLUMN "academic_eligibility" SET DEFAULT 'ANY';