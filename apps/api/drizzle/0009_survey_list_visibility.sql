ALTER TABLE "survey" ADD COLUMN "show_on_list" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "calendar_event" SET "is_hidden_by_admin" = false
WHERE "source_type" = 'KAIST_ACADEMIC'
  AND "title_ko" ~ '^(대체[ ]*공휴일|임시[ ]*공휴일|신정|설날([ ]*연휴)?|추석([ ]*연휴)?|삼일절|3[·.]1절|어린이날|부처님[ ]*오신[ ]*날|석가탄신일|현충일|광복절|개천절|한글날|성탄절|크리스마스|기독탄신일)([ ]*\([^)]*\))?$';
--> statement-breakpoint
UPDATE "survey" SET "show_on_list" = false WHERE "survey_id" = '7a110000-0000-4000-8000-000000000003';
