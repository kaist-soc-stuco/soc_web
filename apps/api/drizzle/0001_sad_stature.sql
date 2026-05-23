ALTER TABLE "role_group" DROP CONSTRAINT "role_group_code_unique";--> statement-breakpoint
ALTER TABLE "role_group" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "role_group" DROP COLUMN "name_en";--> statement-breakpoint
ALTER TABLE "role_group" ADD CONSTRAINT "role_group_name_ko_unique" UNIQUE("name_ko");