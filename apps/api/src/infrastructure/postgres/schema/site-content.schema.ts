import { CONTENT_BLOCK_STATUSES, CONTENT_BLOCK_TYPES, SITE_CONTENT_KEYS } from "@soc/contracts";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

export const siteContentKeyEnum = pgEnum(
  "site_content_key",
  SITE_CONTENT_KEYS,
);

export const siteContents = pgTable("site_content", {
  key: siteContentKeyEnum("key").primaryKey(),
  valueKo: text("value_ko").notNull(),
  valueEn: text("value_en").notNull(),
  updatedBy: uuid("updated_by").references(() => users.userId, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contentBlockTypeEnum = pgEnum("content_block_type", CONTENT_BLOCK_TYPES);
export const contentBlockStatusEnum = pgEnum("content_block_status", CONTENT_BLOCK_STATUSES);

export const contentBlocks = pgTable(
  "content_block",
  {
    contentBlockId: uuid("content_block_id").defaultRandom().primaryKey(),
    type: contentBlockTypeEnum("type").notNull(),
    status: contentBlockStatusEnum("status").notNull().default("DRAFT"),
    titleKo: varchar("title_ko", { length: 255 }).notNull(),
    titleEn: varchar("title_en", { length: 255 }).notNull().default(""),
    bodyKo: text("body_ko"),
    bodyEn: text("body_en"),
    linkUrl: varchar("link_url", { length: 2_000 }),
    imageUrl: varchar("image_url", { length: 2_000 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.userId, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.userId, { onDelete: "set null" }),
    publishedBy: uuid("published_by").references(() => users.userId, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("content_block_status_order_idx").on(table.status, table.sortOrder),
    index("content_block_type_order_idx").on(table.type, table.sortOrder),
  ],
);
