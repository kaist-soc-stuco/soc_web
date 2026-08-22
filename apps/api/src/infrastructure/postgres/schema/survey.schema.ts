import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./auth.schema";
import { articles } from "./board.schema";

export const surveys = pgTable("survey", {
  surveyId: uuid("survey_id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .references(() => users.userId),
  kind: varchar("kind", { length: 20 }).notNull(),
  titleKo: varchar("title_ko", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  connectedArticleId: integer("connected_article_id")
    .references(() => articles.articleId, { onDelete: "set null" }),
  feeRequirementPolicy: varchar("fee_requirement_policy", { length: 20 })
    .notNull()
    .default("NONE"),
  allowMultipleResponses: boolean("allow_multiple_responses").notNull().default(false),
  allowResponseEdit: boolean("allow_response_edit").notNull().default(false),
  isKoreanOnly: boolean("is_korean_only").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  lifecycleStatus: varchar("lifecycle_status", { length: 20 })
    .notNull()
    .default("DRAFT"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  previousVersionId: uuid("previous_version_id").references(
    (): AnyPgColumn => surveys.surveyId,
    { onDelete: "restrict" },
  ),
  versionNumber: integer("version_number").notNull().default(1),
  showOnCalendar: boolean("show_on_calendar").notNull().default(false),
  resultVisibility: varchar("result_visibility", { length: 20 })
    .notNull()
    .default("PRIVATE"),
  maxResponseCount: integer("max_response_count"),
  isAlwaysOpen: boolean("is_always_open").notNull().default(false),
  openAt: timestamp("open_at", { withTimezone: true }),
  closeAt: timestamp("close_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("survey_connected_article_published_idx").on(
    table.connectedArticleId,
    table.isPublished,
  ),
  index("survey_published_created_idx").on(table.isPublished, table.createdAt),
  index("survey_lifecycle_created_idx").on(table.lifecycleStatus, table.createdAt),
  index("survey_previous_version_idx").on(table.previousVersionId),
  index("survey_creator_idx").on(table.creatorId),
  check(
    "survey_lifecycle_status_check",
    sql`${table.lifecycleStatus} in ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
  ),
  check(
    "survey_lifecycle_published_check",
    sql`(${table.lifecycleStatus} = 'PUBLISHED') = ${table.isPublished}`,
  ),
  check(
    "survey_lifecycle_archived_at_check",
    sql`(${table.lifecycleStatus} = 'ARCHIVED') = (${table.archivedAt} is not null)`,
  ),
  check("survey_version_number_check", sql`${table.versionNumber} >= 1`),
  check(
    "survey_previous_version_check",
    sql`${table.previousVersionId} is null or ${table.previousVersionId} <> ${table.surveyId}`,
  ),
]);

export const surveySections = pgTable("survey_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  surveyId: uuid("survey_id")
    .references(() => surveys.surveyId, { onDelete: "cascade" })
    .notNull(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("survey_sections_survey_sort_idx").on(table.surveyId, table.sortOrder),
]);

export const surveyQuestions = pgTable("survey_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: uuid("section_id")
    .references(() => surveySections.id, { onDelete: "cascade" })
    .notNull(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  questionType: text("question_type").notNull(),
  options: jsonb("options"),
  config: jsonb("config"),
  answerRegex: text("answer_regex"),
  isRequired: boolean("is_required").notNull().default(true),
  editDeadlineAt: timestamp("edit_deadline_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("survey_questions_section_sort_idx").on(table.sectionId, table.sortOrder),
]);

export const surveyResponses = pgTable("survey_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  surveyId: uuid("survey_id")
    .references(() => surveys.surveyId, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.userId),
  singleResponseUserId: uuid("single_response_user_id").references(
    () => users.userId,
  ),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("survey_responses_survey_status_submitted_idx").on(
    table.surveyId,
    table.status,
    table.submittedAt,
  ),
  index("survey_responses_survey_user_idx").on(table.surveyId, table.userId),
  uniqueIndex("survey_responses_single_response_user_unique_idx").on(
    table.surveyId,
    table.singleResponseUserId,
  ),
  index("survey_responses_user_created_idx").on(table.userId, table.createdAt),
]);

export const surveyAnswers = pgTable("survey_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: uuid("response_id")
    .references(() => surveyResponses.id, { onDelete: "cascade" })
    .notNull(),
  questionId: uuid("question_id")
    .references(() => surveyQuestions.id)
    .notNull(),
  content: jsonb("content").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("survey_answers_response_idx").on(table.responseId),
  index("survey_answers_question_idx").on(table.questionId),
]);
