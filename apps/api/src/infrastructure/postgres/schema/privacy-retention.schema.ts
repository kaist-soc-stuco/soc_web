import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth.schema";

export const privacyRetentionCases = pgTable("privacy_retention_case", {
  kind: varchar("kind", { length: 20 }).notNull(),
  resourceId: uuid("resource_id").notNull(),
  sourceVersion: text("source_version").notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  holdUntil: timestamp("hold_until", { withTimezone: true }),
  holdReason: varchar("hold_reason", { length: 300 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedCount: integer("deleted_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.userId, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.kind, table.resourceId] }),
  index("privacy_retention_due_idx").on(table.completedAt, table.expiresAt),
  check("privacy_retention_kind_check", sql`${table.kind} in ('SURVEY', 'APPLICATION', 'VOTE', 'FEE_PAYMENT', 'CONTACT')`),
  check("privacy_retention_dates_check", sql`${table.expiresAt} >= ${table.finalizedAt}`),
  check("privacy_retention_hold_check", sql`${table.holdUntil} is null or ${table.holdReason} is not null`),
]);
