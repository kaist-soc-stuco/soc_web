import {
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

import { users } from "./auth.schema";

export const bulkEmails = pgTable("bulk_email", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 10 }).notNull().default("html"),
  recipientType: varchar("recipient_type", { length: 30 }).notNull().default("ALL"),
  recipientFilters: jsonb("recipient_filters").$type<Record<string, string> | null>(),
  attachmentAssetIds: jsonb("attachment_asset_ids").$type<string[] | null>(),
  senderId: uuid("sender_id")
    .references(() => users.userId, { onDelete: "set null" }),
  recipientCount: integer("recipient_count").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  errorMessage: text("error_message"),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
}, (table) => [
  index("bulk_email_sent_idx").on(table.sentAt),
  index("bulk_email_sender_sent_idx").on(table.senderId, table.sentAt),
  index("bulk_email_scheduled_idx").on(table.status, table.scheduledAt),
  uniqueIndex("bulk_email_idempotency_unique").on(table.senderId, table.idempotencyKey),
]);

export const bulkEmailTemplates = pgTable("bulk_email_template", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }).notNull().default(""),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 10 }).notNull().default("html"),
  recipientType: varchar("recipient_type", { length: 30 }).notNull().default("ALL"),
  recipientFilters: jsonb("recipient_filters").$type<Record<string, string> | null>(),
  createdBy: uuid("created_by").references(() => users.userId, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bulk_email_template_updated_idx").on(table.updatedAt),
  index("bulk_email_template_creator_idx").on(table.createdBy),
]);
