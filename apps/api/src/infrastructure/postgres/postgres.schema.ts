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
export const reactionTypeEnum = pgEnum("reaction_type", ["LIKE", "DISLIKE"]);
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
