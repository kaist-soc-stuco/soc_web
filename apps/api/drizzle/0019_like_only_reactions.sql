DELETE FROM "article_reactions" WHERE "type" = 'DISLIKE';--> statement-breakpoint
ALTER TYPE "public"."reaction_type" RENAME TO "reaction_type_legacy";--> statement-breakpoint
CREATE TYPE "public"."reaction_type" AS ENUM('LIKE');--> statement-breakpoint
ALTER TABLE "article_reactions" ALTER COLUMN "type" TYPE "public"."reaction_type" USING "type"::text::"public"."reaction_type";--> statement-breakpoint
DROP TYPE "public"."reaction_type_legacy";
