CREATE TYPE "survey_presentation_block_type" AS ENUM ('DESCRIPTION', 'IMAGE');

CREATE TABLE "survey_image_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" "asset_status" NOT NULL DEFAULT 'INITIATED',
  "provider" text NOT NULL,
  "object_key" text NOT NULL UNIQUE,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "checksum_sha256" text,
  "object_deletion_status" "asset_object_deletion_status" NOT NULL DEFAULT 'PENDING',
  "object_deletion_attempts" integer NOT NULL DEFAULT 0,
  "last_object_deletion_error_code" text,
  "completed_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "purge_after" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "survey_image_assets_byte_size_positive" CHECK ("byte_size" > 0),
  CONSTRAINT "survey_image_assets_dimensions_positive" CHECK (("width" IS NULL AND "height" IS NULL) OR ("width" > 0 AND "height" > 0)),
  CONSTRAINT "survey_image_assets_completed_lifecycle" CHECK (("status" = 'INITIATED' AND "completed_at" IS NULL) OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL) OR "status" = 'DELETED'),
  CONSTRAINT "survey_image_assets_deleted_lifecycle" CHECK (("status" = 'DELETED') = ("deleted_at" IS NOT NULL)),
  CONSTRAINT "survey_image_assets_purge_lifecycle" CHECK (("status" = 'DELETED' AND "purge_after" IS NOT NULL AND "purge_after" >= "deleted_at") OR ("status" <> 'DELETED' AND "purge_after" IS NULL)),
  CONSTRAINT "survey_image_assets_object_deletion_lifecycle" CHECK ("object_deletion_status" <> 'DELETED' OR "status" = 'DELETED'),
  CONSTRAINT "survey_image_assets_deletion_attempts_nonnegative" CHECK ("object_deletion_attempts" >= 0)
);
CREATE INDEX "survey_image_assets_orphan_cleanup_idx" ON "survey_image_assets" ("status", "created_at");

CREATE TABLE "survey_presentation_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "survey_revision_id" uuid NOT NULL REFERENCES "survey_revisions"("id") ON DELETE CASCADE,
  "ordinal" integer NOT NULL,
  "type" "survey_presentation_block_type" NOT NULL,
  "description_kr" text,
  "description_en" text,
  "image_asset_id" uuid REFERENCES "survey_image_assets"("id"),
  "alt_kr" text,
  "alt_en" text,
  "caption_kr" text,
  "caption_en" text,
  CONSTRAINT "survey_presentation_blocks_ordinal_nonnegative" CHECK ("ordinal" >= 0),
  CONSTRAINT "survey_presentation_blocks_shape" CHECK (("type" = 'DESCRIPTION' AND "description_kr" IS NOT NULL AND "description_en" IS NOT NULL AND "image_asset_id" IS NULL AND "alt_kr" IS NULL AND "alt_en" IS NULL AND "caption_kr" IS NULL AND "caption_en" IS NULL) OR ("type" = 'IMAGE' AND "description_kr" IS NULL AND "description_en" IS NULL AND "image_asset_id" IS NOT NULL AND "alt_kr" IS NOT NULL AND "alt_en" IS NOT NULL)),
  CONSTRAINT "survey_presentation_blocks_description_nonblank" CHECK ("description_kr" IS NULL OR (btrim("description_kr") <> '' AND btrim("description_en") <> '')),
  CONSTRAINT "survey_presentation_blocks_image_text_nonblank" CHECK (("alt_kr" IS NULL OR btrim("alt_kr") <> '') AND ("alt_en" IS NULL OR btrim("alt_en") <> '') AND ("caption_kr" IS NULL OR btrim("caption_kr") <> '') AND ("caption_en" IS NULL OR btrim("caption_en") <> '')),
  CONSTRAINT "survey_presentation_blocks_caption_pair" CHECK (("caption_kr" IS NULL) = ("caption_en" IS NULL)),
  CONSTRAINT "survey_presentation_blocks_revision_ordinal_unique" UNIQUE ("survey_revision_id", "ordinal")
);
