import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Google Sheets 쓰기를 HTTP 요청과 분리하는 영속 작업 큐입니다. */
export const googleSpreadsheetSyncJobs = pgTable(
  "google_spreadsheet_sync_job",
  {
    googleSpreadsheetSyncJobId: serial("google_spreadsheet_sync_job_id").primaryKey(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    resourceKey: varchar("resource_key", { length: 255 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("PENDING"),
    revision: integer("revision").notNull().default(1),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("google_spreadsheet_sync_job_due_idx").on(table.status, table.availableAt),
    uniqueIndex("google_spreadsheet_sync_job_resource_idx").on(
      table.resourceType,
      table.resourceKey,
    ),
    check(
      "google_spreadsheet_sync_job_status_check",
      sql`${table.status} in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')`,
    ),
    check("google_spreadsheet_sync_job_revision_check", sql`${table.revision} >= 1`),
    check("google_spreadsheet_sync_job_attempts_check", sql`${table.attempts} >= 0`),
  ],
);
