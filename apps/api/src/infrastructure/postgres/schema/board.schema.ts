import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { permissions, users } from "./auth.schema";

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
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  eventStartDate: timestamp("event_start_date", { withTimezone: true }),
  eventEndDate: timestamp("event_end_date", { withTimezone: true }),
  eventDescription: text("event_description"),
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
]);

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
