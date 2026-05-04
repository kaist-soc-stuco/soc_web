import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  ssoUserId: text("sso_user_id").notNull().unique(),
  permission: integer("permission").notNull().default(0),
  userEmail: text("user_email"),
  userMobile: text("user_mobile"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Survey ───────────────────────────────────────────────────────────────────

export const surveys = pgTable("surveys", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  creatorId: uuid("creator_id").references(() => users.id),
  // 'draft' | 'scheduled' | 'open' | 'closed' | 'archived'
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  connectedPostId: text("connected_post_id"),
  feePayersOnly: boolean("fee_payers_only").notNull().default(false),
  allowAnonymous: boolean("allow_anonymous").notNull().default(false),
  maxResponses: integer("max_responses"),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surveySections = pgTable("survey_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  surveyId: uuid("survey_id")
    .references(() => surveys.id, { onDelete: "cascade" })
    .notNull(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surveyQuestions = pgTable("survey_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: uuid("section_id")
    .references(() => surveySections.id, { onDelete: "cascade" })
    .notNull(),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  // 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'dropdown' | 'date' | 'time' | 'datetime'
  questionType: text("question_type").notNull(),
  // choice 계열: [{ value, labelKo, labelEn? }]
  options: jsonb("options"),
  answerRegex: text("answer_regex"),
  isRequired: boolean("is_required").notNull().default(true),
  editDeadlineAt: timestamp("edit_deadline_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  surveyId: uuid("survey_id")
    .references(() => surveys.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  externalPhone: text("external_phone"),
  // 'draft' | 'submitted' | 'approved' | 'rejected' | 'waitlisted'
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewAdminId: uuid("review_admin_id").references(() => users.id),
  reviewReason: text("review_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surveyAnswers = pgTable("survey_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: uuid("response_id")
    .references(() => surveyResponses.id, { onDelete: "cascade" })
    .notNull(),
  questionId: uuid("question_id")
    .references(() => surveyQuestions.id)
    .notNull(),
  // 타입별 JSON:
  //   short_text / long_text  → { text: string }
  //   single_choice / dropdown → { value: string }
  //   multiple_choice          → { values: string[] }
  //   date                     → { date: "YYYY-MM-DD" }
  //   time                     → { time: "HH:mm" }
  //   datetime                 → { datetime: ISO }
  content: jsonb("content").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
