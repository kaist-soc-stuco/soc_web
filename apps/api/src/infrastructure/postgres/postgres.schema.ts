import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const feeStatusEnum = pgEnum("fee_status", ["UNKNOWN", "UNPAID", "PAID"]);
export const permissionGrantScopeEnum = pgEnum("permission_grant_scope", [
  "GLOBAL",
  "BOARD",
  "EVENT",
  "SURVEY",
]);
export const permissionChangeActionEnum = pgEnum("permission_change_action", [
  "GRANT",
  "REVOKE",
]);
export const permissionChangeRequestStatusEnum = pgEnum("permission_change_request_status", [
  "PENDING",
  "APPROVED",
  "ACTIVATED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);
export const faqStatusEnum = pgEnum("faq_status", ["DRAFT", "PUBLISHED"]);
export const eventVisibilityEnum = pgEnum("event_visibility", [
  "PUBLIC",
  "AUTHENTICATED",
  "COMMITTEE",
]);
export const contentRelationTypeEnum = pgEnum("content_relation_type", ["ANNOUNCEMENT", "SCHEDULE", "SURVEY_PERIOD"]);
export const contentRelationSyncModeEnum = pgEnum("content_relation_sync_mode", ["NONE", "SURVEY_TO_EVENT"]);
export const surveyStateEnum = pgEnum("survey_state", ["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "ARCHIVED"]);
export const surveyResponseStateEnum = pgEnum("survey_response_state", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "WAITLISTED"]);
export const surveyQuestionTypeEnum = pgEnum("survey_question_type", ["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMBER", "DATE"]);
export const surveyFeeRestrictionEnum = pgEnum("survey_fee_restriction", ["ANY", "PAID_ONLY"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Legacy SSO identifier: compatibility input only. It is never runtime authority.
    ssoUserId: text("sso_user_id").notNull().unique(),
    // Immutable canonical SSO subject once populated by the ordered backfill.
    ssoSubject: text("sso_subject"),
    kaistUid: text("kaist_uid"),
    studentOrEmployeeNumber: text("student_or_employee_number"),
    studentOrEmployeeKind: text("student_or_employee_kind"),
    nameKr: text("name_kr"),
    nameEn: text("name_en"),
    majorMask: integer("major_mask").notNull().default(0),
    feeStatus: feeStatusEnum("fee_status").notNull().default("UNKNOWN"),
    // Legacy permission bitmask: read-only backfill input, never effective authority.
    permission: integer("permission").notNull().default(0),
    userEmail: text("user_email"),
    userMobile: text("user_mobile"),
    privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_sso_subject_unique").on(table.ssoSubject),
    uniqueIndex("users_kaist_uid_unique").on(table.kaistUid),
  ],
);
export const userPiiBackfillProgress = pgTable("user_pii_backfill_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobKey: text("job_key").notNull().unique(),
  lastProcessedCreatedAt: timestamp("last_processed_created_at", { withTimezone: true }),
  lastProcessedUserId: uuid("last_processed_user_id").references(() => users.id),
  upperBoundCreatedAt: timestamp("upper_bound_created_at", { withTimezone: true }),
  upperBoundUserId: uuid("upper_bound_user_id").references(() => users.id),
  batchSize: integer("batch_size").notNull().default(500),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissionDefinitions = pgTable(
  "permission_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    description: text("description").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("permission_definitions_key_unique").on(table.key)],
);

export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    permissionDefinitionId: uuid("permission_definition_id")
      .notNull()
      .references(() => permissionDefinitions.id),
    scope: permissionGrantScopeEnum("scope").notNull(),
    scopeId: text("scope_id"),
    grantedByUserId: uuid("granted_by_user_id").notNull().references(() => users.id),
    activatedFrom: timestamp("activated_from", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "permission_grants_scope_id_check",
      sql`(${table.scope} = 'GLOBAL' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'GLOBAL' AND ${table.scopeId} IS NOT NULL)`,
    ),
    index("permission_grants_effective_lookup_idx").on(
      table.userId,
      table.permissionDefinitionId,
      table.scope,
      table.scopeId,
    ),
    uniqueIndex("permission_grants_effective_unique")
      .on(
        table.userId,
        table.permissionDefinitionId,
        table.scope,
        sql`COALESCE(${table.scopeId}, '')`,
      )
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export const permissionChangeRequests = pgTable(
  "permission_change_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetUserId: uuid("target_user_id").notNull().references(() => users.id),
    action: permissionChangeActionEnum("action").notNull(),
    requestedReasonCode: text("requested_reason_code").notNull(),
    permissionDefinitionId: uuid("permission_definition_id")
      .notNull()
      .references(() => permissionDefinitions.id),
    scope: permissionGrantScopeEnum("scope").notNull(),
    scopeId: text("scope_id"),
    requestHash: text("request_hash").notNull(),
    status: permissionChangeRequestStatusEnum("status").notNull().default("PENDING"),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id),
    approverUserId: uuid("approver_user_id").references(() => users.id),
    approvalReasonCode: text("approval_reason_code"),
    activatorUserId: uuid("activator_user_id").references(() => users.id),
    activationReasonCode: text("activation_reason_code"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
  },
  (table) => [
    check(
      "permission_change_requests_scope_id_check",
      sql`(${table.scope} = 'GLOBAL' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'GLOBAL' AND ${table.scopeId} IS NOT NULL)`,
    ),
    check(
      "permission_change_requests_actor_separation_check",
      sql`(${table.approverUserId} IS NULL OR (${table.approverUserId} <> ${table.requesterUserId} AND ${table.approverUserId} <> ${table.targetUserId})) AND (${table.activatorUserId} IS NULL OR ${table.activatorUserId} <> ${table.requesterUserId})`,
    ),
    check(
      "permission_change_requests_requested_reason_code_technical_identifier_check",
      sql`${table.requestedReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_change_requests_approval_reason_code_technical_identifier_check",
      sql`${table.approvalReasonCode} IS NULL OR ${table.approvalReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_change_requests_activation_reason_code_technical_identifier_check",
      sql`${table.activationReasonCode} IS NULL OR ${table.activationReasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    index("permission_change_requests_request_hash_idx").on(table.requestHash),
    index("permission_change_requests_pending_idx").on(table.status, table.expiresAt),
  ],
);

export const permissionAuditLog = pgTable(
  "permission_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    recordId: uuid("record_id").notNull(),
    changedFieldNames: text("changed_field_names").notNull(),
    correlationId: text("correlation_id").notNull(),
    reasonCode: text("reason_code"),
    requestFingerprint: text("request_fingerprint"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "permission_audit_log_action_technical_identifier_check",
      sql`${table.action} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_audit_log_reason_code_technical_identifier_check",
      sql`${table.reasonCode} IS NULL OR ${table.reasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "permission_audit_log_request_fingerprint_check",
      sql`${table.requestFingerprint} IS NULL OR ${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    uniqueIndex("permission_audit_log_fee_idempotency_unique")
      .on(table.actorUserId, table.correlationId)
      .where(sql`${table.action} = 'FEE_STATUS_UPDATED'`),
    index("permission_audit_log_occurred_at_idx").on(table.occurredAt),
    index("permission_audit_log_occurred_at_id_idx").on(table.occurredAt, table.id),
  ],
);

export const faqTopics = pgTable(
  "faq_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    displayOrder: integer("display_order").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("faq_topics_title_kr_nonempty", sql`btrim(${table.titleKr}) <> ''`),
    check("faq_topics_title_en_nonempty", sql`btrim(${table.titleEn}) <> ''`),
    check("faq_topics_display_order_nonnegative", sql`${table.displayOrder} >= 0`),
    uniqueIndex("faq_topics_display_order_unique").on(table.displayOrder),
  ],
);

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").notNull().references(() => faqTopics.id),
    questionKr: text("question_kr").notNull(),
    questionEn: text("question_en").notNull(),
    answerKr: text("answer_kr").notNull(),
    answerEn: text("answer_en").notNull(),
    displayOrder: integer("display_order").notNull(),
    status: faqStatusEnum("status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("faqs_question_kr_nonempty", sql`btrim(${table.questionKr}) <> ''`),
    check("faqs_question_en_nonempty", sql`btrim(${table.questionEn}) <> ''`),
    check("faqs_answer_kr_nonempty", sql`btrim(${table.answerKr}) <> ''`),
    check("faqs_answer_en_nonempty", sql`btrim(${table.answerEn}) <> ''`),
    check("faqs_display_order_nonnegative", sql`${table.displayOrder} >= 0`),
    uniqueIndex("faqs_topic_display_order_unique").on(table.topicId, table.displayOrder),
    index("faqs_public_list_idx").on(table.status, table.topicId, table.displayOrder),
  ],
);
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionKr: text("description_kr").notNull(),
    descriptionEn: text("description_en").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    allDayStartDate: date("all_day_start_date"),
    allDayEndDate: date("all_day_end_date"),
    location: text("location").notNull(),
    visibility: eventVisibilityEnum("visibility").notNull().default("PUBLIC"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("events_title_kr_nonempty", sql`btrim(${table.titleKr}) <> ''`),
    check("events_title_en_nonempty", sql`btrim(${table.titleEn}) <> ''`),
    check("events_description_kr_nonempty", sql`btrim(${table.descriptionKr}) <> ''`),
    check("events_description_en_nonempty", sql`btrim(${table.descriptionEn}) <> ''`),
    check("events_location_nonempty", sql`btrim(${table.location}) <> ''`),
    check("events_time_order", sql`${table.endAt} > ${table.startAt}`),
    check(
      "events_all_day_dates",
      sql`(${table.allDay} = false AND ${table.allDayStartDate} IS NULL AND ${table.allDayEndDate} IS NULL) OR (${table.allDay} = true AND ${table.allDayStartDate} IS NOT NULL AND ${table.allDayEndDate} IS NOT NULL AND ${table.allDayEndDate} > ${table.allDayStartDate})`,
    ),
    index("events_range_idx").on(table.startAt, table.endAt),
    index("events_visibility_range_idx").on(table.visibility, table.startAt, table.endAt),
  ],
);
export const authorizationBootstrapState = pgTable("authorization_bootstrap_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authorizationBackfillProgress = pgTable("authorization_backfill_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobKey: text("job_key").notNull().unique(),
  lastProcessedUserId: uuid("last_processed_user_id").references(() => users.id),
  upperBoundUserId: uuid("upper_bound_user_id").references(() => users.id),
  lastProcessedCreatedAt: timestamp("last_processed_created_at", { withTimezone: true }),
  upperBoundCreatedAt: timestamp("upper_bound_created_at", { withTimezone: true }),
  batchSize: integer("batch_size").notNull().default(500),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentCouncilRoleSnapshots = pgTable(
  "student_council_role_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kaistUidSnapshot: text("kaist_uid_snapshot").notNull(),
    year: integer("year").notNull(),
    roleKey: text("role_key").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("student_council_role_snapshots_user_idx").on(table.userId, table.capturedAt),
    index("student_council_role_snapshots_uid_year_idx").on(
      table.kaistUidSnapshot,
      table.year,
    ),
  ],
);
export const boardPermissionEnum = pgEnum("board_permission", ["PUBLIC", "AUTHENTICATED", "COMMITTEE", "ADMIN"]);
export const articleStatusEnum = pgEnum("article_status", ["DRAFT", "PUBLISHED", "DELETED", "HIDDEN"]);
export const articleScopeEnum = pgEnum("article_scope", ["ALL", "KAIST", "SOC", "AUTHOR_AND_STAFF", "STAFF"]);
export const commentStatusEnum = pgEnum("comment_status", ["PUBLISHED", "SECRET", "DELETED"]);
export const reactionTypeEnum = pgEnum("reaction_type", ["LIKE"]);
export const assetTypeEnum = pgEnum("asset_type", ["IMAGE", "ATTACHMENT", "IMAGE_THUMBNAIL"]);
export const assetStatusEnum = pgEnum("asset_status", ["INITIATED", "COMPLETED", "DELETED"]);
export const assetObjectDeletionStatusEnum = pgEnum("asset_object_deletion_status", ["PENDING", "DELETED", "FAILED"]);
export const legalHoldStatusEnum = pgEnum("legal_hold_status", ["ACTIVE", "RELEASED"]);
export const purgeSubjectTypeEnum = pgEnum("purge_subject_type", ["ARTICLE", "COMMENT", "ASSET"]);
export const purgeActionEnum = pgEnum("purge_action", ["SCHEDULED", "HELD", "PURGED", "CANCELLED"]);

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionKr: text("description_kr").notNull(),
    descriptionEn: text("description_en").notNull(),
    readPermission: boardPermissionEnum("read_permission").notNull(),
    writePermission: boardPermissionEnum("write_permission").notNull().default("AUTHENTICATED"),
    commentPermission: boardPermissionEnum("comment_permission").notNull().default("AUTHENTICATED"),
    commentsAllowed: boolean("comments_allowed").notNull().default(true),
    secretArticlesAllowed: boolean("secret_articles_allowed").notNull().default(false),
    reactionsAllowed: boolean("reactions_allowed").notNull().default(true),
    displayOrder: integer("display_order").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    showOnHome: boolean("show_on_home").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("boards_code_nonempty", sql`btrim(${table.code}) <> ''`),
    check("boards_title_kr_nonempty", sql`btrim(${table.titleKr}) <> ''`),
    check("boards_title_en_nonempty", sql`btrim(${table.titleEn}) <> ''`),
    check("boards_description_kr_nonempty", sql`btrim(${table.descriptionKr}) <> ''`),
    check("boards_description_en_nonempty", sql`btrim(${table.descriptionEn}) <> ''`),
    check("boards_display_order_nonnegative", sql`${table.displayOrder} >= 0`),
    uniqueIndex("boards_code_unique").on(table.code),
    uniqueIndex("boards_display_order_unique").on(table.displayOrder),
    index("boards_home_idx").on(table.showOnHome, table.isHidden, table.displayOrder),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id").notNull().references(() => boards.id),
    authorUserId: uuid("author_user_id").notNull().references(() => users.id),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    bodyKr: text("body_kr").notNull(),
    bodyEn: text("body_en").notNull(),
    status: articleStatusEnum("status").notNull().default("DRAFT"),
    scope: articleScopeEnum("scope").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    pinnedOrder: integer("pinned_order"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("articles_title_kr_nonempty", sql`btrim(${table.titleKr}) <> ''`),
    check("articles_title_en_nonempty", sql`btrim(${table.titleEn}) <> ''`),
    check("articles_body_kr_nonempty", sql`btrim(${table.bodyKr}) <> ''`),
    check("articles_body_en_nonempty", sql`btrim(${table.bodyEn}) <> ''`),
    check("articles_pinned_order_nonnegative", sql`${table.pinnedOrder} IS NULL OR ${table.pinnedOrder} >= 0`),
    check("articles_pinned_state", sql`${table.isPinned} = (${table.pinnedOrder} IS NOT NULL)`),
    check("articles_deleted_at_status", sql`(${table.status} = 'DELETED') = (${table.deletedAt} IS NOT NULL)`),
    check("articles_purge_lifecycle", sql`(${table.status} = 'DELETED' AND ${table.deletedAt} IS NOT NULL AND ${table.purgeAfter} IS NOT NULL AND ${table.purgeAfter} >= ${table.deletedAt}) OR (${table.status} <> 'DELETED' AND ${table.deletedAt} IS NULL AND ${table.purgeAfter} IS NULL)`),
    check("articles_published_at_lifecycle", sql`(${table.status} <> 'PUBLISHED' OR ${table.publishedAt} IS NOT NULL) AND (${table.status} <> 'DRAFT' OR ${table.publishedAt} IS NULL)`),
    index("articles_board_list_idx").on(table.boardId, table.status, table.publishedAt),
    index("articles_purge_idx").on(table.status, table.purgeAfter),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").notNull().references(() => articles.id),
    parentCommentId: uuid("parent_comment_id"),
    authorUserId: uuid("author_user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    status: commentStatusEnum("status").notNull().default("PUBLISHED"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("comments_body_nonempty", sql`btrim(${table.body}) <> ''`),
    check("comments_deleted_at_status", sql`(${table.status} = 'DELETED') = (${table.deletedAt} IS NOT NULL)`),
    check("comments_purge_lifecycle", sql`(${table.status} = 'DELETED' AND ${table.deletedAt} IS NOT NULL AND ${table.purgeAfter} IS NOT NULL AND ${table.purgeAfter} >= ${table.deletedAt}) OR (${table.status} <> 'DELETED' AND ${table.deletedAt} IS NULL AND ${table.purgeAfter} IS NULL)`),
    unique("comments_article_id_unique").on(table.articleId, table.id),
    foreignKey({
      name: "comments_parent_same_article_fk",
      columns: [table.articleId, table.parentCommentId],
      foreignColumns: [table.articleId, table.id],
    }),
    index("comments_article_list_idx").on(table.articleId, table.createdAt),
    index("comments_purge_idx").on(table.status, table.purgeAfter),
  ],
);

export const articleReactions = pgTable(
  "article_reactions",
  {
    articleId: uuid("article_id").notNull().references(() => articles.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: reactionTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("article_reactions_article_user_unique").on(table.articleId, table.userId),
    index("article_reactions_article_type_idx").on(table.articleId, table.type),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").notNull().references(() => articles.id),
    displayOrder: integer("display_order").notNull(),
    type: assetTypeEnum("type").notNull(),
    status: assetStatusEnum("status").notNull().default("INITIATED"),
    provider: text("provider").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256"),
    objectDeletionStatus: assetObjectDeletionStatusEnum("object_deletion_status").notNull().default("PENDING"),
    objectDeletionAttempts: integer("object_deletion_attempts").notNull().default(0),
    lastObjectDeletionErrorCode: text("last_object_deletion_error_code"),
    initiatedByUserId: uuid("initiated_by_user_id").notNull().references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("assets_display_order_nonnegative", sql`${table.displayOrder} >= 0`),
    check("assets_byte_size_positive", sql`${table.byteSize} > 0`),
    check("assets_object_deletion_attempts_nonnegative", sql`${table.objectDeletionAttempts} >= 0`),
    check("assets_object_deletion_error_code_technical_identifier", sql`${table.lastObjectDeletionErrorCode} IS NULL OR ${table.lastObjectDeletionErrorCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`),
    check("assets_completed_at_lifecycle", sql`(${table.status} = 'INITIATED' AND ${table.completedAt} IS NULL) OR (${table.status} = 'COMPLETED' AND ${table.completedAt} IS NOT NULL) OR ${table.status} = 'DELETED'`),
    check("assets_deleted_at_status", sql`(${table.status} = 'DELETED') = (${table.deletedAt} IS NOT NULL)`),
    check("assets_purge_lifecycle", sql`(${table.status} = 'DELETED' AND ${table.deletedAt} IS NOT NULL AND ${table.purgeAfter} IS NOT NULL AND ${table.purgeAfter} >= ${table.deletedAt}) OR (${table.status} <> 'DELETED' AND ${table.deletedAt} IS NULL AND ${table.purgeAfter} IS NULL)`),
    check("assets_object_deletion_status_lifecycle", sql`${table.objectDeletionStatus} <> 'DELETED' OR ${table.status} = 'DELETED'`),
    uniqueIndex("assets_article_display_order_unique").on(table.articleId, table.displayOrder).where(sql`${table.status} <> 'DELETED'`),
    index("assets_purge_idx").on(table.status, table.purgeAfter),
  ],
);

export const legalHolds = pgTable(
  "legal_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    status: legalHoldStatusEnum("status").notNull().default("ACTIVE"),
    reasonCode: text("reason_code").notNull(),
    placedByUserId: uuid("placed_by_user_id").notNull().references(() => users.id),
    releasedByUserId: uuid("released_by_user_id").references(() => users.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("legal_holds_one_subject", sql`num_nonnulls(${table.articleId}, ${table.commentId}, ${table.assetId}) = 1`),
    check("legal_holds_release_state", sql`(${table.status} = 'RELEASED') = (${table.releasedAt} IS NOT NULL)`),
    check("legal_holds_released_by_lifecycle", sql`(${table.status} = 'RELEASED') = (${table.releasedByUserId} IS NOT NULL)`),
    check("legal_holds_reason_code_technical_identifier", sql`${table.reasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`),
    index("legal_holds_active_article_idx").on(table.articleId).where(sql`${table.status} = 'ACTIVE'`),
    index("legal_holds_active_comment_idx").on(table.commentId).where(sql`${table.status} = 'ACTIVE'`),
    index("legal_holds_active_asset_idx").on(table.assetId).where(sql`${table.status} = 'ACTIVE'`),
  ],
);

export const purgeAuditLog = pgTable(
  "purge_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: purgeSubjectTypeEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    action: purgeActionEnum("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    legalHoldId: uuid("legal_hold_id"),
    correlationId: text("correlation_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("purge_audit_log_correlation_identifier", sql`${table.correlationId} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'`),
    index("purge_audit_log_subject_idx").on(table.subjectType, table.subjectId, table.occurredAt),
    index("purge_audit_log_occurred_at_idx").on(table.occurredAt),
  ],
);
export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    state: surveyStateEnum("state").notNull().default("DRAFT"),
    currentRevision: integer("current_revision").notNull().default(1),
    guestAllowed: boolean("guest_allowed").notNull().default(false),
    phoneRequired: boolean("phone_required").notNull().default(false),
    feeRestriction: surveyFeeRestrictionEnum("fee_restriction").notNull().default("ANY"),
    cap: integer("cap"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    editDeadlineAt: timestamp("edit_deadline_at", { withTimezone: true }),
    responseRetentionDays: integer("response_retention_days").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("surveys_revision_positive", sql`${table.currentRevision} > 0`),
    check("surveys_cap_positive", sql`${table.cap} IS NULL OR ${table.cap} > 0`),
    check("surveys_guest_identity_lifecycle", sql`NOT ${table.phoneRequired} OR ${table.guestAllowed}`),
    check("surveys_window_lifecycle", sql`${table.opensAt} IS NULL OR ${table.closesAt} IS NULL OR ${table.opensAt} < ${table.closesAt}`),
    check("surveys_edit_deadline_lifecycle", sql`${table.editDeadlineAt} IS NULL OR ${table.closesAt} IS NULL OR ${table.editDeadlineAt} <= ${table.closesAt}`),
    check("surveys_response_retention_days_bounded", sql`${table.responseRetentionDays} BETWEEN 1 AND 3650`),
  ],
);

export const surveyRevisions = pgTable(
  "survey_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id").notNull().references(() => surveys.id),
    revision: integer("revision").notNull(),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionKr: text("description_kr"),
    descriptionEn: text("description_en"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("survey_revisions_survey_revision_unique").on(table.surveyId, table.revision),
    check("survey_revisions_revision_positive", sql`${table.revision} > 0`),
    check("survey_revisions_title_kr_nonblank", sql`btrim(${table.titleKr}) <> ''`),
    check("survey_revisions_title_en_nonblank", sql`btrim(${table.titleEn}) <> ''`),
    check("survey_revisions_description_kr_nonblank", sql`${table.descriptionKr} IS NULL OR btrim(${table.descriptionKr}) <> ''`),
    check("survey_revisions_description_en_nonblank", sql`${table.descriptionEn} IS NULL OR btrim(${table.descriptionEn}) <> ''`),
  ],
);

export const surveySections = pgTable(
  "survey_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyRevisionId: uuid("survey_revision_id").notNull().references(() => surveyRevisions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    titleKr: text("title_kr").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionKr: text("description_kr"),
    descriptionEn: text("description_en"),
  },
  (table) => [
    uniqueIndex("survey_sections_revision_ordinal_unique").on(table.surveyRevisionId, table.ordinal),
    check("survey_sections_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
    check("survey_sections_title_kr_nonblank", sql`btrim(${table.titleKr}) <> ''`),
    check("survey_sections_title_en_nonblank", sql`btrim(${table.titleEn}) <> ''`),
    check("survey_sections_description_pair", sql`(${table.descriptionKr} IS NULL) = (${table.descriptionEn} IS NULL)`),
    check("survey_sections_description_kr_nonblank", sql`${table.descriptionKr} IS NULL OR btrim(${table.descriptionKr}) <> ''`),
    check("survey_sections_description_en_nonblank", sql`${table.descriptionEn} IS NULL OR btrim(${table.descriptionEn}) <> ''`),
  ],
);

export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id").notNull().references(() => surveySections.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    type: surveyQuestionTypeEnum("type").notNull(),
    promptKr: text("prompt_kr").notNull(),
    promptEn: text("prompt_en").notNull(),
    helpTextKr: text("help_text_kr"),
    helpTextEn: text("help_text_en"),
    required: boolean("required").notNull().default(false),
    validationRegex: text("validation_regex"),
    numberMin: integer("number_min"),
    numberMax: integer("number_max"),
    dateMin: date("date_min"),
    dateMax: date("date_max"),
  },
  (table) => [
    uniqueIndex("survey_questions_section_ordinal_unique").on(table.sectionId, table.ordinal),
    check("survey_questions_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
    check("survey_questions_number_bounds", sql`${table.numberMin} IS NULL OR ${table.numberMax} IS NULL OR ${table.numberMin} <= ${table.numberMax}`),
    check("survey_questions_date_bounds", sql`${table.dateMin} IS NULL OR ${table.dateMax} IS NULL OR ${table.dateMin} <= ${table.dateMax}`),
    check("survey_questions_prompt_kr_nonblank", sql`btrim(${table.promptKr}) <> ''`),
    check("survey_questions_prompt_en_nonblank", sql`btrim(${table.promptEn}) <> ''`),
    check("survey_questions_help_text_kr_nonblank", sql`${table.helpTextKr} IS NULL OR btrim(${table.helpTextKr}) <> ''`),
    check("survey_questions_help_text_en_nonblank", sql`${table.helpTextEn} IS NULL OR btrim(${table.helpTextEn}) <> ''`),
  ],
);

export const surveyChoiceOptions = pgTable(
  "survey_choice_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id").notNull().references(() => surveyQuestions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    valueKr: text("value_kr").notNull(),
    valueEn: text("value_en").notNull(),
  },
  (table) => [
    uniqueIndex("survey_choice_options_question_ordinal_unique").on(table.questionId, table.ordinal),
    check("survey_choice_options_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
    check("survey_choice_options_value_kr_nonblank", sql`btrim(${table.valueKr}) <> ''`),
    check("survey_choice_options_value_en_nonblank", sql`btrim(${table.valueEn}) <> ''`),
  ],
);

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id").notNull().references(() => surveys.id),
    surveyRevisionId: uuid("survey_revision_id").notNull().references(() => surveyRevisions.id),
    campusUserId: uuid("campus_user_id").references(() => users.id),
    guestPhoneCiphertext: text("guest_phone_ciphertext"),
    guestPhoneHash: text("guest_phone_hash"),
    guestPhoneHashVersion: text("guest_phone_hash_version"),
    state: surveyResponseStateEnum("state").notNull().default("DRAFT"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewReason: text("review_reason"),
    retentionDeadlineAt: timestamp("retention_deadline_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("survey_responses_identity_xor", sql`(${table.campusUserId} IS NOT NULL AND ${table.guestPhoneCiphertext} IS NULL AND ${table.guestPhoneHash} IS NULL AND ${table.guestPhoneHashVersion} IS NULL) OR (${table.campusUserId} IS NULL AND ((${table.guestPhoneCiphertext} IS NULL AND ${table.guestPhoneHash} IS NULL AND ${table.guestPhoneHashVersion} IS NULL) OR (${table.guestPhoneCiphertext} IS NOT NULL AND ${table.guestPhoneHash} IS NOT NULL AND ${table.guestPhoneHashVersion} IS NOT NULL)))`),
    check("survey_responses_guest_phone_ciphertext_nonblank", sql`${table.guestPhoneCiphertext} IS NULL OR btrim(${table.guestPhoneCiphertext}) <> ''`),
    check("survey_responses_guest_phone_hash_shape", sql`${table.guestPhoneHash} IS NULL OR ${table.guestPhoneHash} ~ '^[A-Za-z0-9_-]{43}$'`),
    check("survey_responses_guest_phone_hash_version_shape", sql`${table.guestPhoneHashVersion} IS NULL OR ${table.guestPhoneHashVersion} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check("survey_responses_submission_lifecycle", sql`(${table.state} IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')) = (${table.submittedAt} IS NOT NULL)`),
    check("survey_responses_review_lifecycle", sql`(${table.state} IN ('DRAFT', 'SUBMITTED') AND ${table.reviewedAt} IS NULL AND ${table.reviewedByUserId} IS NULL AND ${table.reviewReason} IS NULL) OR (${table.state} IN ('APPROVED', 'WAITLISTED') AND ${table.reviewedAt} IS NOT NULL AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewReason} IS NULL) OR (${table.state} = 'REJECTED' AND ${table.reviewedAt} IS NOT NULL AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewReason} IS NOT NULL AND btrim(${table.reviewReason}) <> '')`),
    check("survey_responses_retention_lifecycle", sql`${table.retentionDeadlineAt} >= ${table.createdAt}`),
    uniqueIndex("survey_responses_campus_user_unique").on(table.surveyId, table.campusUserId).where(sql`${table.campusUserId} IS NOT NULL`),
    index("survey_responses_retention_deadline_idx").on(table.retentionDeadlineAt),
  ],
);

export const surveyResponseAnswers = pgTable(
  "survey_response_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    responseId: uuid("response_id").notNull().references(() => surveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull().references(() => surveyQuestions.id),
    textValue: text("text_value"),
    numberValue: integer("number_value"),
    dateValue: date("date_value"),
    choiceOptionIds: text("choice_option_ids"),
  },
  (table) => [uniqueIndex("survey_response_answers_response_question_unique").on(table.responseId, table.questionId)],
);
export const surveyGuestIdentityHashes = pgTable(
  "survey_guest_identity_hashes",
  {
    responseId: uuid("response_id").notNull().references(() => surveyResponses.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id").notNull().references(() => surveys.id),
    keyVersion: text("key_version").notNull(),
    hash: text("hash").notNull(),
  },
  (table) => [
    uniqueIndex("survey_guest_identity_hashes_response_version_unique").on(table.responseId, table.keyVersion),
    uniqueIndex("survey_guest_identity_hashes_survey_version_hash_unique").on(table.surveyId, table.keyVersion, table.hash),
    index("survey_guest_identity_hashes_response_idx").on(table.responseId),
    check("survey_guest_identity_hashes_key_version_shape", sql`${table.keyVersion} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check("survey_guest_identity_hashes_hash_shape", sql`${table.hash} ~ '^[A-Za-z0-9_-]{43}$'`),
  ],
);

export const contentMatchers = pgTable(
  "content_matchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id").references(() => surveys.id, { onDelete: "cascade" }),
    relationType: contentRelationTypeEnum("relation_type").notNull(),
    syncMode: contentRelationSyncModeEnum("sync_mode").notNull().default("NONE"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    synchronizedAt: timestamp("synchronized_at", { withTimezone: true }),
  },
  (table) => [
    check("content_matchers_exactly_two_subjects", sql`num_nonnulls(${table.articleId}, ${table.eventId}, ${table.surveyId}) = 2`),
    check("content_matchers_relation_type_compatible", sql`
      (${table.relationType} = 'ANNOUNCEMENT' AND ${table.articleId} IS NOT NULL)
      OR (${table.relationType} = 'SCHEDULE' AND ${table.articleId} IS NOT NULL AND ${table.eventId} IS NOT NULL)
      OR (${table.relationType} = 'SURVEY_PERIOD' AND ${table.eventId} IS NOT NULL AND ${table.surveyId} IS NOT NULL)
    `),
    check("content_matchers_sync_compatible", sql`
      (${table.syncMode} = 'NONE' AND ${table.synchronizedAt} IS NULL)
      OR (${table.syncMode} = 'SURVEY_TO_EVENT' AND ${table.relationType} = 'SURVEY_PERIOD' AND ${table.synchronizedAt} IS NOT NULL)
    `),
    uniqueIndex("content_matchers_article_event_unique").on(table.articleId, table.eventId).where(sql`${table.surveyId} IS NULL`),
    uniqueIndex("content_matchers_article_survey_unique").on(table.articleId, table.surveyId).where(sql`${table.eventId} IS NULL`),
    uniqueIndex("content_matchers_event_survey_unique").on(table.eventId, table.surveyId).where(sql`${table.articleId} IS NULL`),
    index("content_matchers_article_idx").on(table.articleId),
    index("content_matchers_event_idx").on(table.eventId),
    index("content_matchers_survey_idx").on(table.surveyId),
  ],
);

export const surveyAuditLog = pgTable(
  "survey_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id").notNull().references(() => surveys.id),
    responseId: uuid("response_id").references(() => surveyResponses.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    changedFieldNames: text("changed_field_names").notNull(),
    correlationId: text("correlation_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("survey_audit_log_action_identifier", sql`${table.action} ~ '^[A-Z][A-Z0-9_]{1,63}$'`),
    check("survey_audit_log_changed_field_names_identifier_list", sql`${table.changedFieldNames} ~ '^[a-z][a-z0-9_]{0,63}(,[a-z][a-z0-9_]{0,63})*$' AND octet_length(${table.changedFieldNames}) <= 1024`),
    check("survey_audit_log_correlation_id_identifier", sql`${table.correlationId} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'`),
    index("survey_audit_log_survey_occurred_idx").on(table.surveyId, table.occurredAt),
  ],
);

export const surveyExports = pgTable(
  "survey_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id").notNull().references(() => surveys.id),
    requestedByUserId: uuid("requested_by_user_id").notNull().references(() => users.id),
    format: text("format").notNull().default("CSV"),
    status: text("status").notNull().default("ACCEPTED"),
    retentionDeadlineAt: timestamp("retention_deadline_at", { withTimezone: true }).notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("survey_exports_format_csv", sql`${table.format} = 'CSV'`),
    check("survey_exports_status_accepted", sql`${table.status} = 'ACCEPTED'`),
    check("survey_exports_retention_lifecycle", sql`${table.retentionDeadlineAt} >= ${table.requestedAt}`),
  ],
);
export const contacts = pgTable(
  "contacts",
  {
    // The primary key is the stable contact identifier; contact values are never used as identifiers.
    id: uuid("id").defaultRandom().primaryKey(),
    nameEnvelope: text("name_envelope").notNull(),
    emailEnvelope: text("email_envelope"),
    phoneEnvelope: text("phone_envelope"),
    affiliationEnvelope: text("affiliation_envelope"),
    noteEnvelope: text("note_envelope"),
    kaistUidEnvelope: text("kaist_uid_envelope"),
    yearEnvelope: text("year_envelope"),
    roleEnvelope: text("role_envelope"),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").notNull().references(() => users.id),
    deletedByUserId: uuid("deleted_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    retentionDeadlineAt: timestamp("retention_deadline_at", { withTimezone: true }).notNull(),
    holdUntil: timestamp("hold_until", { withTimezone: true }),
  },
  (table) => [
    index("contacts_created_id_idx").on(table.createdAt, table.id),
    index("contacts_retention_idx").on(table.retentionDeadlineAt),
    check("contacts_name_envelope_shape", sql`${table.nameEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_email_envelope_shape", sql`${table.emailEnvelope} IS NULL OR ${table.emailEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_phone_envelope_shape", sql`${table.phoneEnvelope} IS NULL OR ${table.phoneEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_affiliation_envelope_shape", sql`${table.affiliationEnvelope} IS NULL OR ${table.affiliationEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_note_envelope_shape", sql`${table.noteEnvelope} IS NULL OR ${table.noteEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_kaist_uid_envelope_shape", sql`${table.kaistUidEnvelope} IS NULL OR ${table.kaistUidEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_year_envelope_shape", sql`${table.yearEnvelope} IS NULL OR ${table.yearEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_role_envelope_shape", sql`${table.roleEnvelope} IS NULL OR ${table.roleEnvelope} ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'`),
    check("contacts_envelopes_nonblank", sql`btrim(${table.nameEnvelope}) <> '' AND (${table.emailEnvelope} IS NULL OR btrim(${table.emailEnvelope}) <> '') AND (${table.phoneEnvelope} IS NULL OR btrim(${table.phoneEnvelope}) <> '') AND (${table.affiliationEnvelope} IS NULL OR btrim(${table.affiliationEnvelope}) <> '') AND (${table.noteEnvelope} IS NULL OR btrim(${table.noteEnvelope}) <> '') AND (${table.kaistUidEnvelope} IS NULL OR btrim(${table.kaistUidEnvelope}) <> '') AND (${table.yearEnvelope} IS NULL OR btrim(${table.yearEnvelope}) <> '') AND (${table.roleEnvelope} IS NULL OR btrim(${table.roleEnvelope}) <> '')`),
    check("contacts_deletion_lifecycle", sql`(${table.deletedAt} IS NULL AND ${table.deletedByUserId} IS NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.deletedByUserId} IS NOT NULL AND ${table.deletedAt} >= ${table.createdAt})`),
    check("contacts_retention_lifecycle", sql`${table.retentionDeadlineAt} >= ${table.createdAt}`),
    check("contacts_hold_lifecycle", sql`${table.holdUntil} IS NULL OR ${table.holdUntil} >= ${table.createdAt}`),
  ],
);

export const contactAuditLog = pgTable(
  "contact_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Deliberately no foreign key: audit entries remain after a contact is purged.
    contactId: uuid("contact_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorSystemIdentity: text("actor_system_identity"),
    action: text("action").notNull(),
    changedFieldNames: text("changed_field_names").notNull(),
    correlationId: text("correlation_id").notNull(),
    reasonCode: text("reason_code"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("contact_audit_log_actor_identity", sql`(${table.actorUserId} IS NOT NULL) <> (${table.actorSystemIdentity} IS NOT NULL)`),
    check("contact_audit_log_system_identity_nonblank", sql`${table.actorSystemIdentity} IS NULL OR btrim(${table.actorSystemIdentity}) <> ''`),
    check("contact_audit_log_action_identifier", sql`${table.action} ~ '^[A-Z][A-Z0-9_]{1,63}$'`),
    check("contact_audit_log_changed_fields", sql`${table.changedFieldNames} ~ '^(name|email|phone|affiliation|note|kaistUid|year|role|retentionDeadlineAt|holdUntil|deletedAt)(,(name|email|phone|affiliation|note|kaistUid|year|role|retentionDeadlineAt|holdUntil|deletedAt))*$'`),
    check("contact_audit_log_correlation_id", sql`${table.correlationId} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'`),
    check("contact_audit_log_reason_code", sql`${table.reasonCode} IS NULL OR ${table.reasonCode} ~ '^[A-Z][A-Z0-9_]{1,63}$'`),
  ],
);
