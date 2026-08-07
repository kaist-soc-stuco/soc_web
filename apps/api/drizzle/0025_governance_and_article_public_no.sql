ALTER TABLE "articles" ADD COLUMN "public_no" integer;
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "board_id" ORDER BY COALESCE("published_at", "created_at"), "id")::integer AS "public_no"
  FROM "articles"
)
UPDATE "articles" AS article
SET "public_no" = numbered."public_no"
FROM numbered
WHERE article."id" = numbered."id";
ALTER TABLE "articles" ALTER COLUMN "public_no" SET NOT NULL;
ALTER TABLE "articles" ADD CONSTRAINT "articles_public_no_positive" CHECK ("public_no" > 0);
CREATE UNIQUE INDEX "articles_board_public_no_unique" ON "articles" ("board_id", "public_no");

CREATE TYPE "vote_state" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'DISCARDED', 'RESULTS_PUBLISHED', 'RESULTS_RETIRED');
CREATE TYPE "vote_voter_identity_kind" AS ENUM ('SSO_SUBJECT', 'STUDENT_NUMBER');
CREATE TYPE "pledge_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'BLOCKED');

CREATE TABLE "votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title_kr" text NOT NULL,
  "title_en" text NOT NULL,
  "description_kr" text NOT NULL,
  "description_en" text NOT NULL,
  "state" "vote_state" DEFAULT 'DRAFT' NOT NULL,
  "opens_at" timestamp with time zone NOT NULL,
  "closes_at" timestamp with time zone NOT NULL,
  "anonymous" boolean DEFAULT true NOT NULL,
  "valid_turnout_percent" integer DEFAULT 50 NOT NULL,
  "results_published_at" timestamp with time zone,
  "results_visible_until" timestamp with time zone,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "votes_title_kr_nonempty" CHECK (btrim("title_kr") <> ''),
  CONSTRAINT "votes_title_en_nonempty" CHECK (btrim("title_en") <> ''),
  CONSTRAINT "votes_description_kr_nonempty" CHECK (btrim("description_kr") <> ''),
  CONSTRAINT "votes_description_en_nonempty" CHECK (btrim("description_en") <> ''),
  CONSTRAINT "votes_window_order" CHECK ("closes_at" > "opens_at"),
  CONSTRAINT "votes_turnout_percent_bounded" CHECK ("valid_turnout_percent" BETWEEN 1 AND 100),
  CONSTRAINT "votes_result_window_shape" CHECK (("results_published_at" IS NULL) = ("results_visible_until" IS NULL) AND ("results_published_at" IS NULL OR "results_visible_until" >= "results_published_at"))
);
CREATE INDEX "votes_public_state_window_idx" ON "votes" ("state", "opens_at", "closes_at");

CREATE TABLE "vote_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vote_id" uuid NOT NULL REFERENCES "votes"("id") ON DELETE CASCADE,
  "ordinal" integer NOT NULL,
  "name_kr" text NOT NULL,
  "name_en" text NOT NULL,
  "description_kr" text DEFAULT '' NOT NULL,
  "description_en" text DEFAULT '' NOT NULL,
  "image_url" text,
  CONSTRAINT "vote_candidates_ordinal_nonnegative" CHECK ("ordinal" >= 0),
  CONSTRAINT "vote_candidates_name_kr_nonempty" CHECK (btrim("name_kr") <> ''),
  CONSTRAINT "vote_candidates_name_en_nonempty" CHECK (btrim("name_en") <> ''),
  CONSTRAINT "vote_candidates_vote_id_id_unique" UNIQUE ("vote_id", "id")
);
CREATE UNIQUE INDEX "vote_candidates_vote_ordinal_unique" ON "vote_candidates" ("vote_id", "ordinal");

CREATE TABLE "vote_voter_rolls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vote_id" uuid NOT NULL REFERENCES "votes"("id") ON DELETE CASCADE,
  "identity_kind" "vote_voter_identity_kind" NOT NULL,
  "identity_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "vote_voter_rolls_hash_shape" CHECK ("identity_hash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "vote_voter_rolls_vote_identity_unique" ON "vote_voter_rolls" ("vote_id", "identity_kind", "identity_hash");
CREATE INDEX "vote_voter_rolls_vote_hash_idx" ON "vote_voter_rolls" ("vote_id", "identity_hash");

CREATE TABLE "vote_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vote_id" uuid NOT NULL REFERENCES "votes"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "vote_participants_vote_user_unique" ON "vote_participants" ("vote_id", "user_id");
CREATE INDEX "vote_participants_vote_idx" ON "vote_participants" ("vote_id", "voted_at");

CREATE TABLE "vote_ballots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vote_id" uuid NOT NULL REFERENCES "votes"("id") ON DELETE CASCADE,
  "candidate_id" uuid NOT NULL REFERENCES "vote_candidates"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "vote_ballots_vote_candidate_fk" FOREIGN KEY ("vote_id", "candidate_id") REFERENCES "vote_candidates"("vote_id", "id") ON DELETE CASCADE
);
CREATE INDEX "vote_ballots_vote_candidate_idx" ON "vote_ballots" ("vote_id", "candidate_id");

CREATE TABLE "pledges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ordinal" integer NOT NULL,
  "title_kr" text NOT NULL,
  "title_en" text NOT NULL,
  "description_kr" text NOT NULL,
  "description_en" text NOT NULL,
  "status" "pledge_status" DEFAULT 'PLANNED' NOT NULL,
  "progress_percent" integer DEFAULT 0 NOT NULL,
  "progress_kr" text NOT NULL,
  "progress_en" text NOT NULL,
  "target_date" date,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pledges_ordinal_nonnegative" CHECK ("ordinal" >= 0),
  CONSTRAINT "pledges_title_kr_nonempty" CHECK (btrim("title_kr") <> ''),
  CONSTRAINT "pledges_title_en_nonempty" CHECK (btrim("title_en") <> ''),
  CONSTRAINT "pledges_description_kr_nonempty" CHECK (btrim("description_kr") <> ''),
  CONSTRAINT "pledges_description_en_nonempty" CHECK (btrim("description_en") <> ''),
  CONSTRAINT "pledges_progress_bounded" CHECK ("progress_percent" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "pledges_ordinal_unique" ON "pledges" ("ordinal");
CREATE INDEX "pledges_public_order_idx" ON "pledges" ("is_published", "ordinal");

INSERT INTO "permission_definitions" ("key", "description", "is_active")
VALUES
  ('VOTE_MANAGE', 'Create, administer, close, and publish votes', true),
  ('PLEDGE_MANAGE', 'Manage pledge progress and public status board', true)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "is_active" = true;
