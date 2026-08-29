ALTER TABLE "roadmap_course" DROP COLUMN "position_x";--> statement-breakpoint
ALTER TABLE "roadmap_course" DROP COLUMN "position_y";--> statement-breakpoint

UPDATE "board"
SET "code" = CASE "code"
  WHEN '공지' THEN 'notice'
  WHEN 'HoC' THEN 'hoc'
  WHEN '홍보글' THEN 'promotions'
  WHEN '건의사항' THEN 'suggestions'
  WHEN '연구실' THEN 'labs'
  WHEN 'FAQ' THEN 'faq'
  ELSE "code"
END
WHERE "code" IN ('공지', 'HoC', '홍보글', '건의사항', '연구실', 'FAQ');--> statement-breakpoint

UPDATE "roadmap_course" AS course
SET "legacy_course_code" = aliases."legacy_course_code"
FROM (VALUES
  ('CS10001', 'CS101'),
  ('CS10009', 'CS109'),
  ('CS10003', 'CS103'),
  ('CS20002', 'CS202'),
  ('CS20004', 'CS204'),
  ('CS20006', 'CS206'),
  ('CS20101', 'CS211'),
  ('CS20200', 'CS220'),
  ('CS20300', 'CS230'),
  ('CS20700', 'CS270'),
  ('CS30000', 'CS300'),
  ('CS30100', 'CS310'),
  ('CS30101', 'CS311'),
  ('CS30200', 'CS320'),
  ('CS30202', 'CS322'),
  ('CS30300', 'CS330'),
  ('CS30401', 'CS341'),
  ('CS30408', 'CS348'),
  ('CS30500', 'CS350'),
  ('CS30600', 'CS360'),
  ('CS30601', 'CS361'),
  ('CS30700', 'CS370'),
  ('CS30701', 'CS371'),
  ('CS30702', 'CS372'),
  ('CS30703', 'CS470'),
  ('CS30704', 'CS374'),
  ('CS30705', 'CS40804'),
  ('CS30706', 'CS376'),
  ('CS30707', 'CS377'),
  ('CS30800', 'CS380'),
  ('CS40002', 'CS402'),
  ('CS40008', 'CS408'),
  ('CS40101', 'CS411'),
  ('CS40200', 'CS420'),
  ('CS40202', 'CS422'),
  ('CS40203', 'CS423'),
  ('CS40204', 'CS424'),
  ('CS40301', 'CS431'),
  ('CS40402', 'CS442'),
  ('CS40403', 'CS443'),
  ('CS40407', 'CS447'),
  ('CS40503', 'CS453'),
  ('CS40504', 'CS454'),
  ('CS40507', 'CS457'),
  ('CS40508', 'CS458'),
  ('CS40509', 'CS459'),
  ('CS40701', 'CS471'),
  ('CS40703', 'CS473'),
  ('CS40704', 'CS474'),
  ('CS40705', 'CS475'),
  ('CS40707', 'CS477'),
  ('CS40709', 'CS479'),
  ('CS40801', 'CS481'),
  ('CS40802', 'CS482'),
  ('CS40805', 'CS485'),
  ('CS40806', 'CS486'),
  ('CS40809', 'CS489'),
  ('CS49900', 'CS492'),
  ('CS49902', 'CS494'),
  ('CS93000', 'CS496')
) AS aliases("course_code", "legacy_course_code")
WHERE course."course_code" = aliases."course_code"
  AND course."legacy_course_code" IS NULL;
