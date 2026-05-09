import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  foreignKey,
  varchar,
  bigint,
  smallint,
  index,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";

// --- 1. Auth / Permission 도메인 ---

export const users = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  ssoSubject: varchar("sso_subject", { length: 100 }).notNull().unique(),
  kaistUid: varchar("kaist_uid", { length: 20 }).notNull().unique(),
  stdNo: varchar("std_no", { length: 20 }).unique(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  
  departmentKo: varchar("dept_ko", { length: 100 }),
  departmentEn: varchar("dept_en", { length: 100 }),
  academicStatus: varchar("academic_status", { length: 20 }), // 재학/휴학 등
  identityCode: varchar("identity_code", { length: 10 }),      // S: 학생 등
  
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permission", {
  permissionId: serial("permission_id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  bitValue: bigint("bit_value", { mode: "number" }).notNull().unique(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roleGroups = pgTable("role_group", {
  roleGroupId: serial("role_group_id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roleGroupPermissions = pgTable("role_group_permission", {
  roleGroupId: integer("role_group_id")
    .notNull()
    .references(() => roleGroups.roleGroupId),
  permissionId: integer("permission_id")
    .notNull()
    .references(() => permissions.permissionId),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roleGroupId, table.permissionId] }),
]);

export const userRoleGroups = pgTable("user_role_group", {
  userRoleGroupId: serial("user_role_group_id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.userId),
  roleGroupId: integer("role_group_id")
    .notNull()
    .references(() => roleGroups.roleGroupId),
  grantedBy: integer("granted_by")
    .references(() => users.userId),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
});

// --- 2. Fee 도메인 ---

export const studentFeeStatus = pgTable("student_fee_status", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.userId),
  coverageSemesters: smallint("coverage_semesters").notNull().default(4),
  status: varchar("status", { length: 20 }).notNull(), // PAID, UNPAID, WAIVED, UNKNOWN
  paidAt: timestamp("paid_at", { withTimezone: true }),
  verifiedBy: integer("verified_by")
    .references(() => users.userId),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- 3. Board / Content 도메인 ---

export const boards = pgTable("board", {
  boardId: serial("board_id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  nameKo: varchar("name_ko", { length: 20 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  description: varchar("description", { length: 255 }),
  readScope: varchar("read_scope", { length: 20 }).notNull().default("PUBLIC"),
  writePermissionId: integer("write_permission_id")
    .references(() => permissions.permissionId),
  commentPermissionId: integer("comment_permission_id")
    .references(() => permissions.permissionId),
  managePermissionId: integer("manage_permission_id")
    .references(() => permissions.permissionId),
  allowComment: boolean("allow_comment").notNull().default(false),
  allowSecret: boolean("allow_secret").notNull().default(false),
  allowLike: boolean("allow_like").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const articles = pgTable("article", {
  articleId: serial("article_id")
    .primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => boards.boardId, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => users.userId),
  titleKo: varchar("title_ko", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }),
  contentKo: text("content_ko").notNull(),
  contentEn: text("content_en"),
  status: varchar("status", { length: 20 }).notNull().default("PUBLISHED"),
  visibilityScope: varchar("visibility_scope", { length: 20 }).notNull().default("PUBLIC"),
  isPinned: boolean("is_pinned").notNull().default(false),
  pinOrder: integer("pin_order"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("article_board_idx").on(table.boardId),
]);

export const assets = pgTable("asset", {
  assetId: serial("asset_id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.userId),
});

export const articleAssets = pgTable("article_asset", {
  articleAssetId: serial("article_asset_id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.articleId, { onDelete: "cascade" }),
  assetId: integer("asset_id")
    .notNull()
    .references(() => assets.assetId, { onDelete: "cascade" }),
  usageType: varchar("usage_type", { length: 20 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const comments = pgTable(
  "comment",
  {
    commentId: serial("comment_id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.articleId, { onDelete: "cascade" }),
    parentCommentId: integer("parent_comment_id"),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => users.userId),
    content: text("content").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PUBLISHED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.commentId],
    }).onDelete("set null"),
  ],
);

// --- 4. Survey / Application 도메인 ---

export const surveys = pgTable("survey", {
  surveyId: serial("survey_id").primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull(), // SURVEY, VOTE, etc
  titleKo: varchar("title_ko", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"), // 누락된 컬럼 추가
  feeRequirementPolicy: varchar("fee_requirement_policy", { length: 20 }).notNull(),
  allowGuestResponse: boolean("allow_guest_response").notNull().default(false),
  resultVisibility: varchar("result_visibility", { length: 20 }).notNull(),
  maxResponseCount: integer("max_response_count"),
  openAt: timestamp("open_at", { withTimezone: true }),
  closeAt: timestamp("close_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- 5. Audit Log ---

export const auditLogs = pgTable("audit_log", {
  auditLogId: serial("audit_log_id").primaryKey(),
  actorUserId: integer("actor_user_id")
    .references(() => users.userId),
  action: varchar("action", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 50 }),
  payload: text("payload"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});