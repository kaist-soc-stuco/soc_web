CREATE TYPE "public"."survey_fee_restriction" AS ENUM('ANY', 'PAID_ONLY');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE');--> statement-breakpoint
CREATE TYPE "public"."survey_response_state" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED');--> statement-breakpoint
CREATE TYPE "public"."survey_state" AS ENUM('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "content_matchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"event_id" uuid,
	"survey_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_matchers_survey_one_content_target" CHECK (num_nonnulls("content_matchers"."article_id", "content_matchers"."event_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "survey_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"response_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"changed_field_names" text NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_audit_log_action_identifier" CHECK ("survey_audit_log"."action" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
	CONSTRAINT "survey_audit_log_changed_field_names_identifier_list" CHECK ("survey_audit_log"."changed_field_names" ~ '^[a-z][a-z0-9_]{0,63}(,[a-z][a-z0-9_]{0,63})*$' AND octet_length("survey_audit_log"."changed_field_names") <= 1024),
	CONSTRAINT "survey_audit_log_correlation_id_identifier" CHECK ("survey_audit_log"."correlation_id" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')
);
--> statement-breakpoint
CREATE TABLE "survey_choice_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"value_kr" text NOT NULL,
	"value_en" text NOT NULL,
	CONSTRAINT "survey_choice_options_ordinal_nonnegative" CHECK ("survey_choice_options"."ordinal" >= 0),
	CONSTRAINT "survey_choice_options_value_kr_nonblank" CHECK (btrim("survey_choice_options"."value_kr") <> ''),
	CONSTRAINT "survey_choice_options_value_en_nonblank" CHECK (btrim("survey_choice_options"."value_en") <> '')
);
--> statement-breakpoint
CREATE TABLE "survey_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"format" text DEFAULT 'CSV' NOT NULL,
	"status" text DEFAULT 'ACCEPTED' NOT NULL,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_exports_format_csv" CHECK ("survey_exports"."format" = 'CSV'),
	CONSTRAINT "survey_exports_status_accepted" CHECK ("survey_exports"."status" = 'ACCEPTED'),
	CONSTRAINT "survey_exports_retention_lifecycle" CHECK ("survey_exports"."retention_deadline_at" >= "survey_exports"."requested_at")
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"prompt_kr" text NOT NULL,
	"prompt_en" text NOT NULL,
	"help_text_kr" text,
	"help_text_en" text,
	"required" boolean DEFAULT false NOT NULL,
	"validation_regex" text,
	"number_min" integer,
	"number_max" integer,
	"date_min" date,
	"date_max" date,
	CONSTRAINT "survey_questions_ordinal_nonnegative" CHECK ("survey_questions"."ordinal" >= 0),
	CONSTRAINT "survey_questions_number_bounds" CHECK ("survey_questions"."number_min" IS NULL OR "survey_questions"."number_max" IS NULL OR "survey_questions"."number_min" <= "survey_questions"."number_max"),
	CONSTRAINT "survey_questions_date_bounds" CHECK ("survey_questions"."date_min" IS NULL OR "survey_questions"."date_max" IS NULL OR "survey_questions"."date_min" <= "survey_questions"."date_max"),
	CONSTRAINT "survey_questions_prompt_kr_nonblank" CHECK (btrim("survey_questions"."prompt_kr") <> ''),
	CONSTRAINT "survey_questions_prompt_en_nonblank" CHECK (btrim("survey_questions"."prompt_en") <> ''),
	CONSTRAINT "survey_questions_help_text_kr_nonblank" CHECK ("survey_questions"."help_text_kr" IS NULL OR btrim("survey_questions"."help_text_kr") <> ''),
	CONSTRAINT "survey_questions_help_text_en_nonblank" CHECK ("survey_questions"."help_text_en" IS NULL OR btrim("survey_questions"."help_text_en") <> '')
);
--> statement-breakpoint
CREATE TABLE "survey_response_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"text_value" text,
	"number_value" integer,
	"date_value" date,
	"choice_option_ids" text
);
--> statement-breakpoint
CREATE TABLE "survey_guest_identity_hashes" (
	"response_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"key_version" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "survey_guest_identity_hashes_key_version_shape" CHECK ("survey_guest_identity_hashes"."key_version" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "survey_guest_identity_hashes_hash_shape" CHECK ("survey_guest_identity_hashes"."hash" ~ '^[A-Za-z0-9_-]{43}$')
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"survey_revision_id" uuid NOT NULL,
	"campus_user_id" uuid,
	"guest_phone_ciphertext" text,
	"guest_phone_hash" text,
	"guest_phone_hash_version" text,
	"state" "survey_response_state" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"review_reason" text,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_responses_identity_xor" CHECK (("survey_responses"."campus_user_id" IS NOT NULL AND "survey_responses"."guest_phone_ciphertext" IS NULL AND "survey_responses"."guest_phone_hash" IS NULL AND "survey_responses"."guest_phone_hash_version" IS NULL) OR ("survey_responses"."campus_user_id" IS NULL AND (("survey_responses"."guest_phone_ciphertext" IS NULL AND "survey_responses"."guest_phone_hash" IS NULL AND "survey_responses"."guest_phone_hash_version" IS NULL) OR ("survey_responses"."guest_phone_ciphertext" IS NOT NULL AND "survey_responses"."guest_phone_hash" IS NOT NULL AND "survey_responses"."guest_phone_hash_version" IS NOT NULL)))),
	CONSTRAINT "survey_responses_guest_phone_ciphertext_nonblank" CHECK ("survey_responses"."guest_phone_ciphertext" IS NULL OR btrim("survey_responses"."guest_phone_ciphertext") <> ''),
	CONSTRAINT "survey_responses_guest_phone_hash_shape" CHECK ("survey_responses"."guest_phone_hash" IS NULL OR "survey_responses"."guest_phone_hash" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "survey_responses_guest_phone_hash_version_shape" CHECK ("survey_responses"."guest_phone_hash_version" IS NULL OR "survey_responses"."guest_phone_hash_version" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "survey_responses_submission_lifecycle" CHECK (("survey_responses"."state" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')) = ("survey_responses"."submitted_at" IS NOT NULL)),
	CONSTRAINT "survey_responses_review_lifecycle" CHECK (("survey_responses"."state" IN ('DRAFT', 'SUBMITTED') AND "survey_responses"."reviewed_at" IS NULL AND "survey_responses"."reviewed_by_user_id" IS NULL AND "survey_responses"."review_reason" IS NULL) OR ("survey_responses"."state" IN ('APPROVED', 'WAITLISTED') AND "survey_responses"."reviewed_at" IS NOT NULL AND "survey_responses"."reviewed_by_user_id" IS NOT NULL AND "survey_responses"."review_reason" IS NULL) OR ("survey_responses"."state" = 'REJECTED' AND "survey_responses"."reviewed_at" IS NOT NULL AND "survey_responses"."reviewed_by_user_id" IS NOT NULL AND "survey_responses"."review_reason" IS NOT NULL AND btrim("survey_responses"."review_reason") <> '')),
	CONSTRAINT "survey_responses_retention_lifecycle" CHECK ("survey_responses"."retention_deadline_at" >= "survey_responses"."created_at")
);
--> statement-breakpoint
CREATE TABLE "survey_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	"description_kr" text,
	"description_en" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "survey_revisions_revision_positive" CHECK ("survey_revisions"."revision" > 0),
	CONSTRAINT "survey_revisions_title_kr_nonblank" CHECK (btrim("survey_revisions"."title_kr") <> ''),
	CONSTRAINT "survey_revisions_title_en_nonblank" CHECK (btrim("survey_revisions"."title_en") <> ''),
	CONSTRAINT "survey_revisions_description_kr_nonblank" CHECK ("survey_revisions"."description_kr" IS NULL OR btrim("survey_revisions"."description_kr") <> ''),
	CONSTRAINT "survey_revisions_description_en_nonblank" CHECK ("survey_revisions"."description_en" IS NULL OR btrim("survey_revisions"."description_en") <> '')
);
--> statement-breakpoint
CREATE TABLE "survey_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_revision_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	CONSTRAINT "survey_sections_ordinal_nonnegative" CHECK ("survey_sections"."ordinal" >= 0),
	CONSTRAINT "survey_sections_title_kr_nonblank" CHECK (btrim("survey_sections"."title_kr") <> ''),
	CONSTRAINT "survey_sections_title_en_nonblank" CHECK (btrim("survey_sections"."title_en") <> '')
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" "survey_state" DEFAULT 'DRAFT' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"guest_allowed" boolean DEFAULT false NOT NULL,
	"phone_required" boolean DEFAULT false NOT NULL,
	"fee_restriction" "survey_fee_restriction" DEFAULT 'ANY' NOT NULL,
	"cap" integer,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"edit_deadline_at" timestamp with time zone,
	"response_retention_days" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_revision_positive" CHECK ("surveys"."current_revision" > 0),
	CONSTRAINT "surveys_cap_positive" CHECK ("surveys"."cap" IS NULL OR "surveys"."cap" > 0),
	CONSTRAINT "surveys_guest_identity_lifecycle" CHECK (NOT "surveys"."phone_required" OR "surveys"."guest_allowed"),
	CONSTRAINT "surveys_window_lifecycle" CHECK ("surveys"."opens_at" IS NULL OR "surveys"."closes_at" IS NULL OR "surveys"."opens_at" < "surveys"."closes_at"),
	CONSTRAINT "surveys_edit_deadline_lifecycle" CHECK ("surveys"."edit_deadline_at" IS NULL OR "surveys"."closes_at" IS NULL OR "surveys"."edit_deadline_at" <= "surveys"."closes_at"),
	CONSTRAINT "surveys_response_retention_days_bounded" CHECK ("surveys"."response_retention_days" BETWEEN 1 AND 3650)
);
--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_matchers" ADD CONSTRAINT "content_matchers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_audit_log" ADD CONSTRAINT "survey_audit_log_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_audit_log" ADD CONSTRAINT "survey_audit_log_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_audit_log" ADD CONSTRAINT "survey_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_choice_options" ADD CONSTRAINT "survey_choice_options_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_exports" ADD CONSTRAINT "survey_exports_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_exports" ADD CONSTRAINT "survey_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_section_id_survey_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."survey_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response_answers" ADD CONSTRAINT "survey_response_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response_answers" ADD CONSTRAINT "survey_response_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_guest_identity_hashes" ADD CONSTRAINT "survey_guest_identity_hashes_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_guest_identity_hashes" ADD CONSTRAINT "survey_guest_identity_hashes_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_revision_id_survey_revisions_id_fk" FOREIGN KEY ("survey_revision_id") REFERENCES "public"."survey_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_campus_user_id_users_id_fk" FOREIGN KEY ("campus_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_revisions" ADD CONSTRAINT "survey_revisions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_revisions" ADD CONSTRAINT "survey_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_survey_revision_id_survey_revisions_id_fk" FOREIGN KEY ("survey_revision_id") REFERENCES "public"."survey_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_matchers_article_survey_unique" ON "content_matchers" USING btree ("article_id","survey_id") WHERE "content_matchers"."event_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "content_matchers_event_survey_unique" ON "content_matchers" USING btree ("event_id","survey_id") WHERE "content_matchers"."article_id" IS NULL;--> statement-breakpoint
CREATE INDEX "survey_audit_log_survey_occurred_idx" ON "survey_audit_log" USING btree ("survey_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_choice_options_question_ordinal_unique" ON "survey_choice_options" USING btree ("question_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_questions_section_ordinal_unique" ON "survey_questions" USING btree ("section_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_response_answers_response_question_unique" ON "survey_response_answers" USING btree ("response_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_guest_identity_hashes_response_version_unique" ON "survey_guest_identity_hashes" USING btree ("response_id","key_version");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_guest_identity_hashes_survey_version_hash_unique" ON "survey_guest_identity_hashes" USING btree ("survey_id","key_version","hash");--> statement-breakpoint
CREATE INDEX "survey_guest_identity_hashes_response_idx" ON "survey_guest_identity_hashes" USING btree ("response_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_campus_user_unique" ON "survey_responses" USING btree ("survey_id","campus_user_id") WHERE "survey_responses"."campus_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "survey_responses_retention_deadline_idx" ON "survey_responses" USING btree ("retention_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_revisions_survey_revision_unique" ON "survey_revisions" USING btree ("survey_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_sections_revision_ordinal_unique" ON "survey_sections" USING btree ("survey_revision_id","ordinal");
--> statement-breakpoint
CREATE FUNCTION "public"."guard_published_survey_definition"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  revision_ids uuid[] := ARRAY[]::uuid[];
  revision_locked boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'survey_revisions' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'published_survey_definition_immutable' USING ERRCODE = '23514';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'published_survey_definition_immutable' USING ERRCODE = '23514';
      END IF;
      IF NEW.published_at IS NOT NULL
        AND (NEW.id, NEW.survey_id, NEW.revision, NEW.title_kr, NEW.title_en,
             NEW.description_kr, NEW.description_en, NEW.created_by_user_id, NEW.created_at)
            IS DISTINCT FROM
            (OLD.id, OLD.survey_id, OLD.revision, OLD.title_kr, OLD.title_en,
             OLD.description_kr, OLD.description_en, OLD.created_by_user_id, OLD.created_at) THEN
        RAISE EXCEPTION 'published_survey_definition_immutable' USING ERRCODE = '23514';
      END IF;
      IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL THEN
        PERFORM public.validate_published_survey_definition_complete(NEW.id);
      END IF;
    ELSIF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'published_survey_definition_immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'survey_sections' THEN
    IF TG_OP <> 'INSERT' THEN revision_ids := array_append(revision_ids, OLD.survey_revision_id); END IF;
    IF TG_OP <> 'DELETE' THEN revision_ids := array_append(revision_ids, NEW.survey_revision_id); END IF;
  ELSIF TG_TABLE_NAME = 'survey_questions' THEN
    IF TG_OP <> 'INSERT' THEN
      SELECT array_append(revision_ids, section.survey_revision_id) INTO revision_ids
      FROM public.survey_sections AS section WHERE section.id = OLD.section_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT array_append(revision_ids, section.survey_revision_id) INTO revision_ids
      FROM public.survey_sections AS section WHERE section.id = NEW.section_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'survey_choice_options' THEN
    IF TG_OP <> 'INSERT' THEN
      SELECT array_append(revision_ids, section.survey_revision_id) INTO revision_ids
      FROM public.survey_questions AS question JOIN public.survey_sections AS section ON section.id = question.section_id
      WHERE question.id = OLD.question_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT array_append(revision_ids, section.survey_revision_id) INTO revision_ids
      FROM public.survey_questions AS question JOIN public.survey_sections AS section ON section.id = question.section_id
      WHERE question.id = NEW.question_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported_survey_definition_table' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME <> 'survey_revisions' THEN
    PERFORM 1 FROM public.survey_revisions AS revision
    WHERE revision.id = ANY(revision_ids)
    ORDER BY revision.id
    FOR UPDATE;
    SELECT EXISTS (
      SELECT 1 FROM public.survey_revisions AS revision
      WHERE revision.id = ANY(revision_ids) AND revision.published_at IS NOT NULL
    ) INTO revision_locked;
    IF revision_locked THEN
      RAISE EXCEPTION 'published_survey_definition_immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_survey_revisions_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."survey_revisions"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_survey_definition"();
--> statement-breakpoint
CREATE TRIGGER "guard_survey_sections_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."survey_sections"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_survey_definition"();
--> statement-breakpoint
CREATE TRIGGER "guard_survey_questions_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."survey_questions"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_survey_definition"();
--> statement-breakpoint
CREATE TRIGGER "guard_survey_choice_options_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."survey_choice_options"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_survey_definition"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_published_survey_current_revision"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.state <> 'DRAFT'::public.survey_state
    AND NOT EXISTS (
      SELECT 1
      FROM public.survey_revisions AS revision
      WHERE revision.survey_id = NEW.id
        AND revision.revision = NEW.current_revision
        AND revision.published_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'published_survey_current_revision_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validate_published_survey_current_revision"
AFTER INSERT OR UPDATE OF state, current_revision ON "public"."surveys"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public"."validate_published_survey_current_revision"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_response_revision"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.survey_revisions AS revision
    WHERE revision.id = NEW.survey_revision_id
      AND revision.survey_id = NEW.survey_id
  ) THEN
    RAISE EXCEPTION 'survey_response_revision_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "validate_survey_response_revision"
BEFORE INSERT OR UPDATE OF survey_id, survey_revision_id ON "public"."survey_responses"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_response_revision"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_response_answer"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  question_type public.survey_question_type;
  question_regex text;
  question_number_min integer;
  question_number_max integer;
  question_date_min date;
  question_date_max date;
  selected_choices jsonb;
  selected_count integer;
  distinct_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.response_id IS DISTINCT FROM OLD.response_id THEN
    RAISE EXCEPTION 'survey_answer_response_immutable' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.survey_responses AS response WHERE response.id = NEW.response_id FOR UPDATE;
  SELECT question.type, question.validation_regex, question.number_min, question.number_max,
         question.date_min, question.date_max
  INTO question_type, question_regex, question_number_min, question_number_max,
       question_date_min, question_date_max
  FROM public.survey_responses AS response
  JOIN public.survey_questions AS question ON question.id = NEW.question_id
  JOIN public.survey_sections AS section ON section.id = question.section_id
  WHERE response.id = NEW.response_id
    AND section.survey_revision_id = response.survey_revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'survey_answer_revision_mismatch' USING ERRCODE = '23514';
  END IF;
  IF num_nonnulls(NEW.text_value, NEW.number_value, NEW.date_value, NEW.choice_option_ids) <> 1 THEN
    RAISE EXCEPTION 'survey_answer_value_shape_invalid' USING ERRCODE = '23514';
  END IF;

  IF question_type IN ('SHORT_TEXT', 'LONG_TEXT') THEN
    IF NEW.text_value IS NULL
      OR NEW.text_value = ''
      OR octet_length(NEW.text_value) > 8192
      OR (question_regex IS NOT NULL AND NEW.text_value !~ question_regex) THEN
      RAISE EXCEPTION 'survey_text_answer_invalid' USING ERRCODE = '23514';
    END IF;
  ELSIF question_type = 'NUMBER' THEN
    IF NEW.number_value IS NULL
      OR (question_number_min IS NOT NULL AND NEW.number_value < question_number_min)
      OR (question_number_max IS NOT NULL AND NEW.number_value > question_number_max) THEN
      RAISE EXCEPTION 'survey_number_answer_invalid' USING ERRCODE = '23514';
    END IF;
  ELSIF question_type = 'DATE' THEN
    IF NEW.date_value IS NULL
      OR (question_date_min IS NOT NULL AND NEW.date_value < question_date_min)
      OR (question_date_max IS NOT NULL AND NEW.date_value > question_date_max) THEN
      RAISE EXCEPTION 'survey_date_answer_invalid' USING ERRCODE = '23514';
    END IF;
  ELSE
    BEGIN
      selected_choices := NEW.choice_option_ids::jsonb;
    EXCEPTION WHEN SQLSTATE '22P02' THEN
      RAISE EXCEPTION 'survey_choice_answer_invalid' USING ERRCODE = '23514';
    END;
    IF jsonb_typeof(selected_choices) <> 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(selected_choices) AS choice(value)
        WHERE jsonb_typeof(choice.value) <> 'string'
          OR choice.value #>> '{}' !~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$'
      ) THEN
      RAISE EXCEPTION 'survey_choice_answer_invalid' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), count(DISTINCT choice.value)
    INTO selected_count, distinct_count
    FROM jsonb_array_elements_text(selected_choices) AS choice(value);
    IF selected_count = 0 OR selected_count <> distinct_count
      OR (question_type = 'SINGLE_CHOICE' AND selected_count <> 1) THEN
      RAISE EXCEPTION 'survey_choice_answer_invalid' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(selected_choices) AS choice(value)
      LEFT JOIN public.survey_choice_options AS option
        ON option.id = choice.value::uuid
       AND option.question_id = NEW.question_id
      WHERE option.id IS NULL
    ) THEN
      RAISE EXCEPTION 'survey_choice_revision_mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "validate_survey_response_answer"
BEFORE INSERT OR UPDATE ON "public"."survey_response_answers"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_response_answer"();
CREATE FUNCTION "public"."lock_survey_response_for_answer_mutation"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1
  FROM public.survey_responses AS response
  WHERE response.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.response_id ELSE NEW.response_id END
  FOR UPDATE;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "lock_survey_response_for_answer_mutation"
BEFORE DELETE ON "public"."survey_response_answers"
FOR EACH ROW EXECUTE FUNCTION "public"."lock_survey_response_for_answer_mutation"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_audit_response_ownership"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.response_id IS NOT NULL THEN
    PERFORM 1 FROM public.survey_responses AS response WHERE response.id = NEW.response_id FOR UPDATE;
  END IF;
  IF NEW.response_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.survey_responses AS response
    WHERE response.id = NEW.response_id AND response.survey_id = NEW.survey_id
  ) THEN
    RAISE EXCEPTION 'survey_audit_response_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "validate_survey_audit_response_ownership"
BEFORE INSERT OR UPDATE OF survey_id, response_id ON "public"."survey_audit_log"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_audit_response_ownership"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_published_survey_definition_complete"(revision_id uuid) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $survey_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.survey_sections AS section
    WHERE section.survey_revision_id = revision_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.survey_questions AS question
    JOIN public.survey_sections AS section ON section.id = question.section_id
    WHERE section.survey_revision_id = revision_id
  ) OR EXISTS (
    SELECT 1
    FROM public.survey_questions AS question
    JOIN public.survey_sections AS section ON section.id = question.section_id
    WHERE section.survey_revision_id = revision_id
      AND (
        (question.type IN ('SHORT_TEXT', 'LONG_TEXT')
          AND question.number_min IS NULL AND question.number_max IS NULL
          AND question.date_min IS NULL AND question.date_max IS NULL
          AND (question.validation_regex IS NULL OR (
            octet_length(question.validation_regex) <= 256
            AND question.validation_regex ~ '^\^\[[A-Za-z0-9 .,_@+-]+\](\{[0-9]+(,[0-9]+)?\}|[+*?])\$$'
            AND NOT EXISTS (
              SELECT 1
              FROM regexp_match(question.validation_regex, '\{([0-9]+)(?:,([0-9]+))?\}\$$') AS pattern_parts(values)
              WHERE pattern_parts.values[1]::numeric > 8192
                OR (pattern_parts.values[2] IS NOT NULL AND (pattern_parts.values[2]::numeric > 8192 OR pattern_parts.values[1]::numeric > pattern_parts.values[2]::numeric))
            )
          )))
        OR (question.type = 'NUMBER'
          AND question.validation_regex IS NULL AND question.date_min IS NULL AND question.date_max IS NULL
          AND (question.number_min IS NULL OR question.number_max IS NULL OR question.number_min <= question.number_max))
        OR (question.type = 'DATE'
          AND question.validation_regex IS NULL AND question.number_min IS NULL AND question.number_max IS NULL
          AND (question.date_min IS NULL OR question.date_max IS NULL OR question.date_min <= question.date_max))
        OR (question.type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE')
          AND question.validation_regex IS NULL AND question.number_min IS NULL AND question.number_max IS NULL
          AND question.date_min IS NULL AND question.date_max IS NULL
          AND EXISTS (SELECT 1 FROM public.survey_choice_options AS option WHERE option.question_id = question.id))
      ) IS NOT TRUE
  )
  OR EXISTS (
    SELECT 1 FROM public.survey_choice_options AS option
    JOIN public.survey_questions AS question ON question.id = option.question_id
    JOIN public.survey_sections AS section ON section.id = question.section_id
    WHERE section.survey_revision_id = revision_id
      AND question.type NOT IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE')
  ) THEN
    RAISE EXCEPTION 'published_survey_definition_incomplete' USING ERRCODE = '23514';
  END IF;
END;
$survey_definition$;
--> statement-breakpoint
CREATE FUNCTION "public"."validate_required_survey_response_answers"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  checked_response_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'survey_responses' THEN
    checked_response_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    checked_response_id := OLD.response_id;
  ELSE
    checked_response_id := NEW.response_id;
  END IF;
  PERFORM 1 FROM public.survey_responses AS response
  WHERE response.id = checked_response_id
  FOR UPDATE;
  IF EXISTS (
    SELECT 1
    FROM public.survey_responses AS response
    WHERE response.id = checked_response_id
      AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
      AND EXISTS (
        SELECT 1
        FROM public.survey_questions AS question
        JOIN public.survey_sections AS section ON section.id = question.section_id
        WHERE section.survey_revision_id = response.survey_revision_id
          AND question.required
          AND NOT EXISTS (
            SELECT 1 FROM public.survey_response_answers AS answer
            WHERE answer.response_id = response.id AND answer.question_id = question.id
          )
      )
  ) THEN
    RAISE EXCEPTION 'survey_required_answer_missing' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validate_required_survey_response_answers_on_response"
AFTER INSERT OR UPDATE OF state, survey_revision_id ON "public"."survey_responses"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public"."validate_required_survey_response_answers"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validate_required_survey_response_answers_on_answer"
AFTER INSERT OR UPDATE OR DELETE ON "public"."survey_response_answers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public"."validate_required_survey_response_answers"();
--> statement-breakpoint
CREATE FUNCTION "public"."guard_survey_response_ownership_and_retention"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  close_at timestamp with time zone;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.survey_id, NEW.survey_revision_id) IS DISTINCT FROM (OLD.survey_id, OLD.survey_revision_id) THEN
    RAISE EXCEPTION 'survey_response_ownership_immutable' USING ERRCODE = '23514';
  END IF;
  SELECT closes_at INTO close_at FROM public.surveys WHERE id = NEW.survey_id FOR KEY SHARE;
  IF close_at IS NULL OR NEW.retention_deadline_at < close_at THEN
    RAISE EXCEPTION 'survey_response_retention_before_close' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_survey_response_ownership_and_retention"
BEFORE INSERT OR UPDATE ON "public"."survey_responses"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_survey_response_ownership_and_retention"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_guest_identity_hash_ownership"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1 FROM public.survey_responses AS response WHERE response.id = NEW.response_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.survey_responses AS response WHERE response.id = NEW.response_id AND response.survey_id = NEW.survey_id) THEN
    RAISE EXCEPTION 'survey_guest_identity_hash_response_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "validate_survey_guest_identity_hash_ownership"
BEFORE INSERT OR UPDATE OF response_id, survey_id ON "public"."survey_guest_identity_hashes"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_guest_identity_hash_ownership"();
--> statement-breakpoint
CREATE FUNCTION "public"."guard_survey_guest_identity_hash_active_alias"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.survey_responses AS response
    WHERE response.id = OLD.response_id
      AND response.survey_id = OLD.survey_id
      AND response.guest_phone_hash_version = OLD.key_version
      AND response.guest_phone_hash = OLD.hash
  ) AND (TG_OP = 'DELETE' OR (NEW.response_id, NEW.survey_id, NEW.key_version, NEW.hash) IS DISTINCT FROM (OLD.response_id, OLD.survey_id, OLD.key_version, OLD.hash)) THEN
    RAISE EXCEPTION 'survey_response_active_identity_alias_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_survey_guest_identity_hash_active_alias"
BEFORE UPDATE OR DELETE ON "public"."survey_guest_identity_hashes"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_survey_guest_identity_hash_active_alias"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_response_active_identity_alias"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.guest_phone_hash IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.survey_guest_identity_hashes AS identity_hash
    WHERE identity_hash.response_id = NEW.id
      AND identity_hash.survey_id = NEW.survey_id
      AND identity_hash.key_version = NEW.guest_phone_hash_version
      AND identity_hash.hash = NEW.guest_phone_hash
  ) THEN
    RAISE EXCEPTION 'survey_response_active_identity_alias_missing' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validate_survey_response_active_identity_alias"
AFTER INSERT OR UPDATE OF survey_id, guest_phone_hash, guest_phone_hash_version ON "public"."survey_responses"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_response_active_identity_alias"();
--> statement-breakpoint
CREATE FUNCTION "public"."validate_survey_export_retention"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE close_at timestamp with time zone;
BEGIN
  SELECT closes_at INTO close_at FROM public.surveys WHERE id = NEW.survey_id FOR KEY SHARE;
  IF close_at IS NULL OR NEW.retention_deadline_at < close_at THEN
    RAISE EXCEPTION 'survey_export_retention_before_close' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "validate_survey_export_retention"
BEFORE INSERT OR UPDATE OF survey_id, retention_deadline_at ON "public"."survey_exports"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_survey_export_retention"();
--> statement-breakpoint
CREATE FUNCTION "public"."guard_survey_close_against_retention"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.closes_at IS DISTINCT FROM OLD.closes_at
    AND (
      EXISTS (
        SELECT 1 FROM public.survey_responses AS response
        WHERE response.survey_id = NEW.id
          AND (NEW.closes_at IS NULL OR response.retention_deadline_at < NEW.closes_at)
      )
      OR EXISTS (
        SELECT 1 FROM public.survey_exports AS export
        WHERE export.survey_id = NEW.id
          AND (NEW.closes_at IS NULL OR export.retention_deadline_at < NEW.closes_at)
      )
    ) THEN
    RAISE EXCEPTION 'survey_close_exceeds_retention_deadline' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "guard_survey_close_against_retention"
BEFORE UPDATE OF closes_at ON "public"."surveys"
FOR EACH ROW EXECUTE FUNCTION "public"."guard_survey_close_against_retention"();
--> statement-breakpoint
INSERT INTO "permission_definitions" ("key", "description", "is_active")
VALUES
  ('SURVEY_MANAGE', 'Create, revise, publish, and match surveys', true),
  ('SURVEY_REVIEW', 'Review, aggregate, and export survey responses', true)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description",
    "is_active" = EXCLUDED."is_active";