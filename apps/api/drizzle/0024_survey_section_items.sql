CREATE TYPE "survey_section_item_kind" AS ENUM ('QUESTION', 'DESCRIPTION', 'IMAGE_BLOCK');
CREATE TYPE "survey_image_block_mode" AS ENUM ('SHARED', 'LOCALIZED');
CREATE TYPE "survey_image_membership_set" AS ENUM ('SHARED', 'KO', 'EN');
ALTER TYPE "asset_object_deletion_status" ADD VALUE IF NOT EXISTS 'CLAIMED';
ALTER TABLE "surveys" ADD COLUMN "only_for_korean_speaker" boolean NOT NULL DEFAULT false;
CREATE TABLE "survey_section_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "section_id" uuid NOT NULL REFERENCES "survey_sections"("id") ON DELETE CASCADE,
  "ordinal" integer NOT NULL,
  "kind" "survey_section_item_kind" NOT NULL,
  "question_id" uuid REFERENCES "survey_questions"("id"),
  CONSTRAINT "survey_section_items_ordinal_nonnegative" CHECK ("ordinal" >= 0),
  CONSTRAINT "survey_section_items_question_shape" CHECK (("kind" = 'QUESTION') = ("question_id" IS NOT NULL)),
  CONSTRAINT "survey_section_items_section_ordinal_unique" UNIQUE ("section_id", "ordinal"),
  CONSTRAINT "survey_section_items_question_unique" UNIQUE ("question_id")
);
CREATE INDEX "survey_section_items_section_order_idx" ON "survey_section_items" ("section_id", "ordinal", "id");
CREATE TABLE "survey_section_description_items" (
  "item_id" uuid PRIMARY KEY REFERENCES "survey_section_items"("id") ON DELETE CASCADE,
  "body_kr" text NOT NULL,
  "body_en" text NOT NULL,
  CONSTRAINT "survey_section_description_items_kr_nonblank" CHECK (btrim("body_kr") <> ''),
  CONSTRAINT "survey_section_description_items_en_nonblank" CHECK (btrim("body_en") <> '')
);
CREATE TABLE "survey_image_blocks" (
  "item_id" uuid PRIMARY KEY REFERENCES "survey_section_items"("id") ON DELETE CASCADE,
  "mode" "survey_image_block_mode" NOT NULL DEFAULT 'SHARED',
  "shared_membership_count" integer NOT NULL DEFAULT 0,
  "ko_membership_count" integer NOT NULL DEFAULT 0,
  "en_membership_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "survey_image_blocks_counts_nonnegative" CHECK ("shared_membership_count" >= 0 AND "ko_membership_count" >= 0 AND "en_membership_count" >= 0),
  CONSTRAINT "survey_image_blocks_mode_counts" CHECK (("mode" = 'SHARED' AND "ko_membership_count" = 0 AND "en_membership_count" = 0) OR ("mode" = 'LOCALIZED' AND "shared_membership_count" = 0))
);
CREATE TABLE "survey_image_block_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "block_id" uuid NOT NULL REFERENCES "survey_image_blocks"("item_id") ON DELETE CASCADE,
  "set" "survey_image_membership_set" NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "survey_image_assets"("id"),
  "order_key" integer NOT NULL,
  CONSTRAINT "survey_image_block_memberships_set_order_unique" UNIQUE ("block_id", "set", "order_key"),
  CONSTRAINT "survey_image_block_memberships_set_asset_unique" UNIQUE ("block_id", "set", "asset_id")
);
CREATE INDEX "survey_image_block_memberships_page_idx" ON "survey_image_block_memberships" ("block_id", "set", "order_key", "id");
CREATE INDEX "survey_image_block_memberships_asset_reachability_idx" ON "survey_image_block_memberships" ("asset_id", "block_id");

CREATE TABLE "survey_image_membership_mutations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "survey_id" uuid NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "client_mutation_id" uuid NOT NULL,
  "operation" text NOT NULL,
  "request_hash" text NOT NULL,
  "result_json" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "survey_image_membership_mutations_actor_survey_client_unique" UNIQUE ("actor_user_id", "survey_id", "client_mutation_id")
);
CREATE TABLE "survey_image_cleanup_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "survey_image_assets"("id") ON DELETE CASCADE,
  "claim_token" uuid NOT NULL UNIQUE,
  "claimed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "next_retry_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error_code" text,
  "attempts" integer NOT NULL DEFAULT 0,
  CONSTRAINT "survey_image_cleanup_claims_attempts_nonnegative" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "survey_image_cleanup_claims_open_asset_unique" ON "survey_image_cleanup_claims" ("asset_id") WHERE "completed_at" IS NULL;
CREATE INDEX "survey_image_cleanup_claims_retry_idx" ON "survey_image_cleanup_claims" ("next_retry_at");
CREATE OR REPLACE FUNCTION "survey_section_item_revision_validate"() RETURNS trigger AS $$
DECLARE item_revision uuid; question_revision uuid; question_section uuid;
BEGIN
  SELECT "survey_revision_id" INTO item_revision FROM "survey_sections" WHERE "id" = NEW."section_id";
  IF NEW."kind" = 'QUESTION' THEN
    IF NEW."question_id" IS NULL THEN RAISE EXCEPTION 'QUESTION item requires question'; END IF;
    SELECT section."survey_revision_id", question."section_id"
      INTO question_revision, question_section
      FROM "survey_questions" AS question
      JOIN "survey_sections" AS section ON section."id" = question."section_id"
      WHERE question."id" = NEW."question_id";
    IF question_revision IS DISTINCT FROM item_revision OR question_section IS DISTINCT FROM NEW."section_id" THEN RAISE EXCEPTION 'question item section mismatch'; END IF;
  ELSIF NEW."question_id" IS NOT NULL THEN RAISE EXCEPTION 'non-question item cannot reference question';
  END IF;
  IF NEW."kind" = 'DESCRIPTION' AND NOT EXISTS (SELECT 1 FROM "survey_section_description_items" WHERE "item_id" = NEW."id") THEN RAISE EXCEPTION 'DESCRIPTION item requires description subtype'; END IF;
  IF NEW."kind" = 'IMAGE_BLOCK' AND NOT EXISTS (SELECT 1 FROM "survey_image_blocks" WHERE "item_id" = NEW."id") THEN RAISE EXCEPTION 'IMAGE_BLOCK item requires image block subtype'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "survey_section_item_revision_trigger" AFTER INSERT OR UPDATE ON "survey_section_items" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_section_item_revision_validate"();
CREATE OR REPLACE FUNCTION "survey_section_item_order_validate"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT count(*) AS count, min("ordinal") AS min_ordinal, max("ordinal") AS max_ordinal
      FROM "survey_section_items" WHERE "section_id" = COALESCE(NEW."section_id", OLD."section_id")
    ) AS order_state
    WHERE count > 0 AND (min_ordinal <> 0 OR max_ordinal <> count - 1)
  ) THEN RAISE EXCEPTION 'survey section item order must be continuous';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "survey_section_item_order_trigger" AFTER INSERT OR UPDATE OR DELETE ON "survey_section_items" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_section_item_order_validate"();
CREATE OR REPLACE FUNCTION "survey_section_item_subtype_validate"() RETURNS trigger AS $$
DECLARE item_kind "survey_section_item_kind"; item_id uuid;
BEGIN
  item_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."item_id" ELSE NEW."item_id" END;
  SELECT "kind" INTO item_kind FROM "survey_section_items" WHERE "id" = item_id;
  IF item_kind IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'subtype requires parent item';
  END IF;
  IF TG_TABLE_NAME = 'survey_section_description_items' AND item_kind <> 'DESCRIPTION' THEN RAISE EXCEPTION 'description subtype kind mismatch'; END IF;
  IF TG_TABLE_NAME = 'survey_image_blocks' AND item_kind <> 'IMAGE_BLOCK' THEN RAISE EXCEPTION 'image block subtype kind mismatch'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'survey_section_description_items' THEN RAISE EXCEPTION 'DESCRIPTION item requires description subtype'; END IF;
    IF TG_TABLE_NAME = 'survey_image_blocks' THEN RAISE EXCEPTION 'IMAGE_BLOCK item requires image block subtype'; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "survey_description_item_kind_trigger" AFTER INSERT OR UPDATE OR DELETE ON "survey_section_description_items" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_section_item_subtype_validate"();
CREATE CONSTRAINT TRIGGER "survey_image_block_kind_trigger" AFTER INSERT OR UPDATE OR DELETE ON "survey_image_blocks" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_section_item_subtype_validate"();
INSERT INTO "survey_section_items" ("section_id", "ordinal", "kind", "question_id")
SELECT "section_id", "ordinal", 'QUESTION', "id" FROM "survey_questions" ORDER BY "section_id", "ordinal", "id";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "survey_questions" AS question
    FULL OUTER JOIN "survey_section_items" AS item
      ON item."question_id" = question."id" AND item."kind" = 'QUESTION'
    WHERE question."id" IS NULL
      OR item."id" IS NULL
      OR item."section_id" <> question."section_id"
      OR item."ordinal" <> question."ordinal"
  ) THEN
    RAISE EXCEPTION 'survey section item backfill reconciliation failed: question identity, ownership, or ordinal mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "section_id", "ordinal", lag("ordinal") OVER (PARTITION BY "section_id" ORDER BY "ordinal", "id") AS previous_ordinal
      FROM "survey_section_items"
    ) AS ordered
    WHERE previous_ordinal IS NOT NULL AND "ordinal" <> previous_ordinal + 1
  ) THEN
    RAISE EXCEPTION 'survey section item backfill reconciliation failed: non-continuous item ordinal';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION "survey_ordered_definition_immutable"() RETURNS trigger AS $$
DECLARE item uuid; revision_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'survey_section_items' THEN
    item := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
    SELECT "survey_revision_id" INTO revision_id FROM "survey_sections"
    WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."section_id" ELSE NEW."section_id" END;
  ELSIF TG_TABLE_NAME = 'survey_section_description_items' OR TG_TABLE_NAME = 'survey_image_blocks' THEN
    item := CASE WHEN TG_OP = 'DELETE' THEN OLD."item_id" ELSE NEW."item_id" END;
  ELSIF TG_TABLE_NAME = 'survey_image_block_memberships' THEN
    item := CASE WHEN TG_OP = 'DELETE' THEN OLD."block_id" ELSE NEW."block_id" END;
  END IF;
  IF TG_TABLE_NAME <> 'survey_section_items' THEN
    SELECT section."survey_revision_id" INTO revision_id
    FROM "survey_section_items" AS section_item
    JOIN "survey_sections" AS section ON section."id" = section_item."section_id"
    WHERE section_item."id" = item;
  END IF;
  IF EXISTS (SELECT 1 FROM "survey_revisions" WHERE "id" = revision_id AND "published_at" IS NOT NULL) THEN
    RAISE EXCEPTION 'published_survey_definition_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "survey_section_items_published_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "survey_section_items" FOR EACH ROW EXECUTE FUNCTION "survey_ordered_definition_immutable"();
CREATE TRIGGER "survey_description_items_published_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "survey_section_description_items" FOR EACH ROW EXECUTE FUNCTION "survey_ordered_definition_immutable"();
CREATE TRIGGER "survey_image_blocks_published_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "survey_image_blocks" FOR EACH ROW EXECUTE FUNCTION "survey_ordered_definition_immutable"();
CREATE TRIGGER "survey_image_memberships_published_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "survey_image_block_memberships" FOR EACH ROW EXECUTE FUNCTION "survey_ordered_definition_immutable"();
CREATE OR REPLACE FUNCTION "survey_image_block_topology_validate"() RETURNS trigger AS $$
DECLARE block_mode "survey_image_block_mode"; shared_count integer; ko_count integer; en_count integer; target_block uuid;
BEGIN
  IF TG_TABLE_NAME = 'survey_image_blocks' THEN
    target_block := CASE WHEN TG_OP = 'DELETE' THEN OLD."item_id" ELSE NEW."item_id" END;
  ELSE
    target_block := CASE WHEN TG_OP = 'DELETE' THEN OLD."block_id" ELSE NEW."block_id" END;
  END IF;
  SELECT "mode", "shared_membership_count", "ko_membership_count", "en_membership_count"
    INTO block_mode, shared_count, ko_count, en_count FROM "survey_image_blocks" WHERE "item_id" = target_block;
  IF TG_TABLE_NAME = 'survey_image_block_memberships' AND TG_OP <> 'DELETE' THEN
    IF (block_mode = 'SHARED' AND NEW."set" <> 'SHARED') OR (block_mode = 'LOCALIZED' AND NEW."set" = 'SHARED') THEN
      RAISE EXCEPTION 'image membership mode-set mismatch';
    END IF;
  END IF;
  IF (SELECT count(*) FROM "survey_image_block_memberships" WHERE "block_id" = target_block AND "set" = 'SHARED') <> shared_count
    OR (SELECT count(*) FROM "survey_image_block_memberships" WHERE "block_id" = target_block AND "set" = 'KO') <> ko_count
    OR (SELECT count(*) FROM "survey_image_block_memberships" WHERE "block_id" = target_block AND "set" = 'EN') <> en_count THEN RAISE EXCEPTION 'image membership counter mismatch'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "survey_image_membership_topology_trigger" AFTER INSERT OR UPDATE OR DELETE ON "survey_image_block_memberships" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_image_block_topology_validate"();
CREATE CONSTRAINT TRIGGER "survey_image_block_topology_trigger" AFTER UPDATE ON "survey_image_blocks" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "survey_image_block_topology_validate"();
ALTER TABLE "survey_sections" DROP COLUMN "description_kr", DROP COLUMN "description_en";
DROP TABLE "survey_presentation_blocks";
DROP TYPE "survey_presentation_block_type";
