import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  foreignKey,
  serial,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  ssoUserId: text("sso_user_id").notNull().unique(),
  name: text("name"),
  permission: integer("permission").notNull().default(0),
  userEmail: text("user_email"),
  userMobile: text("user_mobile"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const boards = pgTable("board", {
  boardId: serial("board_id").primaryKey(),
  code: text("code").notNull().unique(),
  nameKo: text("name_ko").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  readScope: text("read_scope").notNull().default("PUBLIC"),
  writePermissionId: integer("write_permission_id").notNull().default(0),
  commentPermissionId: integer("comment_permission_id").notNull().default(0),
  managePermissionId: integer("manage_permission_id").notNull().default(0),
  allowComment: boolean("allow_comment").notNull().default(true),
  allowSecret: boolean("allow_secret").notNull().default(false),
  allowLike: boolean("allow_like").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const articles = pgTable("article", {
  articleId: serial("article_id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => boards.boardId, {
      onDelete: "cascade",
    }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => users.id),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  contentKo: text("content_ko").notNull(),
  contentEn: text("content_en"),
  status: text("status").notNull().default("PUBLISHED"),
  visibilityScope: text("visibility_scope").notNull().default("PUBLIC"),
  isPinned: boolean("is_pinned").notNull().default(false),
  pinOrder: integer("pin_order"),
  postedAt: timestamp("posted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const assets = pgTable("asset", {
  assetId: serial("asset_id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
});

export const articleAssets = pgTable("article_asset", {
  articleAssetId: serial("article_asset_id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.articleId, {
      onDelete: "cascade",
    }),
  assetId: integer("asset_id")
    .notNull()
    .references(() => assets.assetId, {
      onDelete: "cascade",
    }),
  usageType: text("usage_type").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const comments = pgTable(
  "comment",
  {
    commentId: serial("comment_id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.articleId, {
        onDelete: "cascade",
      }),
    parentCommentId: integer("parent_comment_id"),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    status: text("status").notNull().default("PUBLISHED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    parentCommentFk: foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.commentId],
    }).onDelete("set null"),
  }),
);
