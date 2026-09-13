
BEGIN;
INSERT INTO survey(survey_id,kind,title_ko,allow_anonymous,is_always_open) VALUES('70000000-0000-4000-8000-000000000012','SURVEY','[QA] 응답 화면 검증',true,true);
INSERT INTO survey_sections(id,survey_id,title_ko) VALUES('71000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000012','검증 섹션');
INSERT INTO survey_questions(id,section_id,title_ko,question_type,options) VALUES('72000000-0000-4000-8000-000000000012','71000000-0000-4000-8000-000000000012','선호 항목','single_choice','[{"value":"a","labelKo":"A"},{"value":"b","labelKo":"B"}]');
INSERT INTO survey_responses(id,survey_id,submitted_at) VALUES('73000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000012',now()),('74000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000012',now());
INSERT INTO survey_answers(response_id,question_id,content) VALUES('73000000-0000-4000-8000-000000000012','72000000-0000-4000-8000-000000000012','{"value":"a"}'),('74000000-0000-4000-8000-000000000012','72000000-0000-4000-8000-000000000012','{"value":"b"}');
COMMIT;
