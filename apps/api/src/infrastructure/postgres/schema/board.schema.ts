import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { permissions, users } from "./auth.schema";

export const boards = pgTable("board", {
  boardId: serial("board_id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  nameKo: varchar("name_ko", { length: 20 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  descriptionKo: varchar("description_ko", { length: 255 }),
  descriptionEn: varchar("description_en", { length: 255 }),
  writePermissionId: integer("write_permission_id")
    .references(() => permissions.permissionId),
  allowComment: boolean("allow_comment").notNull().default(false),
  allowSecret: boolean("allow_secret").notNull().default(false),
  allowLike: boolean("allow_like").notNull().default(true),
  allowGuestRead: boolean("allow_guest_read").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const articles = pgTable("article", {
  articleId: serial("article_id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => boards.boardId, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id")
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
  homeVisible: boolean("home_visible").notNull().default(true),
  homeOrder: integer("home_order"),
  isSecret: boolean("is_secret").notNull().default(false),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  allowComment: boolean("allow_comment").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  hiddenByUserId: uuid("hidden_by_user_id").references(() => users.userId),
  hiddenReason: varchar("hidden_reason", { length: 500 }),
  eventStartDate: timestamp("event_start_date", { withTimezone: true }),
  eventEndDate: timestamp("event_end_date", { withTimezone: true }),
  eventDescriptionKo: text("event_description_ko"),
  eventDescriptionEn: text("event_description_en"),
}, (table) => [
  index("article_board_idx").on(table.boardId),
  index("article_board_status_posted_idx").on(
    table.boardId,
    table.status,
    table.postedAt,
  ),
  index("article_status_posted_idx").on(table.status, table.postedAt),
  index("article_author_status_posted_idx").on(
    table.authorUserId,
    table.status,
    table.postedAt,
  ),
  index("article_home_presentation_idx").on(
    table.homeVisible,
    table.homeOrder,
    table.eventStartDate,
  ),
]);

/** 인증 사용자별 게시글 조회 기록. 복합 PK가 동일 사용자의 재방문 증가를 막는다. */
export const articleViews = pgTable(
  "article_view",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.articleId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.userId] }),
    index("article_view_user_idx").on(table.userId, table.createdAt),
  ],
);

export const articleEngagements = pgTable(
  "article_engagement",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.articleId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.userId, table.kind] }),
    index("article_engagement_user_kind_idx").on(
      table.userId,
      table.kind,
      table.updatedAt,
    ),
  ],
);

export const articleDrafts = pgTable(
  "article_draft",
  {
    draftId: uuid("draft_id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    boardId: integer("board_id")
      .notNull()
      .references(() => boards.boardId, { onDelete: "restrict" }),
    targetArticleId: integer("target_article_id").references(
      () => articles.articleId,
      { onDelete: "set null" },
    ),
    titleKo: varchar("title_ko", { length: 255 }).notNull().default(""),
    titleEn: varchar("title_en", { length: 255 }),
    contentKo: text("content_ko").notNull().default(""),
    contentEn: text("content_en"),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    version: integer("version").notNull().default(1),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("article_draft_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt,
    ),
    index("article_draft_board_updated_idx").on(
      table.boardId,
      table.updatedAt,
    ),
  ],
);

export const assets = pgTable("asset", {
  assetId: serial("asset_id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.userId),
}, (table) => [
  index("asset_created_idx").on(table.createdAt),
  index("asset_uploaded_by_idx").on(table.uploadedBy),
]);

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
}, (table) => [
  index("article_asset_article_usage_sort_idx").on(
    table.articleId,
    table.usageType,
    table.sortOrder,
  ),
  index("article_asset_asset_idx").on(table.assetId),
]);

export const comments = pgTable(
  "comment",
  {
    commentId: serial("comment_id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.articleId, { onDelete: "cascade" }),
    parentCommentId: integer("parent_comment_id"),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.userId),
    content: text("content").notNull(),
    isOfficial: boolean("is_official").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("PUBLISHED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenByUserId: uuid("hidden_by_user_id").references(() => users.userId),
    hiddenReason: text("hidden_reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.commentId],
    }).onDelete("set null"),
    index("comment_article_status_created_idx").on(
      table.articleId,
      table.status,
      table.createdAt,
    ),
    index("comment_author_status_created_idx").on(
      table.authorUserId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const commentEngagements = pgTable(
  "comment_engagement",
  {
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.commentId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId, table.kind] }),
    index("comment_engagement_user_kind_idx").on(
      table.userId,
      table.kind,
      table.updatedAt,
    ),
  ],
);
