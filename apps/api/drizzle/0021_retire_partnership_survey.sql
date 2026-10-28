-- Partnership inquiries now use Channel Talk. Retain any existing responses.
UPDATE "survey"
SET "is_published" = false,
    "lifecycle_status" = 'DRAFT',
    "accepting_responses" = false,
    "show_on_list" = false,
    "show_on_calendar" = false,
    "updated_at" = now()
WHERE "survey_id" = '7a110000-0000-4000-8000-000000000003';
