import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

/** 사이트 공식 일정과 외부 읽기 전용 일정을 함께 저장합니다. */
export const calendarEvents = pgTable("calendar_event", {
  calendarEventId: serial("calendar_event_id").primaryKey(),
  titleKo: varchar("title_ko", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  isAllDay: boolean("is_all_day").notNull().default(false),
  isAlways: boolean("is_always").notNull().default(false),
  location: varchar("location", { length: 255 }),
  sourceUid: varchar("source_uid", { length: 255 }),
  sourceType: varchar("source_type", { length: 32 }).notNull().default("MANUAL"),
  sourceYear: integer("source_year"),
  sourceHash: varchar("source_hash", { length: 64 }),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  isHiddenByAdmin: boolean("is_hidden_by_admin").notNull().default(false),
  categoryOverride: varchar("category_override", { length: 20 }),
  overrideUpdatedByUserId: uuid("override_updated_by_user_id").references(() => users.userId),
  overrideUpdatedAt: timestamp("override_updated_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => users.userId),
  googleCalendarId: varchar("google_calendar_id", { length: 255 }),
  googleEventId: varchar("google_event_id", { length: 255 }),
  googleEtag: varchar("google_etag", { length: 255 }),
  googleSyncStatus: varchar("google_sync_status", { length: 20 })
    .notNull()
    .default("NOT_CONFIGURED"),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  googleSyncError: text("google_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("calendar_event_range_idx").on(table.startAt, table.endAt),
  index("calendar_event_source_uid_idx").on(table.sourceUid),
  index("calendar_event_source_year_idx").on(table.sourceType, table.sourceYear),
  uniqueIndex("calendar_event_source_identity_idx").on(table.sourceType, table.sourceUid),
  uniqueIndex("calendar_event_google_identity_idx").on(table.googleCalendarId, table.googleEventId),
]);

export const calendarSyncJobs = pgTable("calendar_sync_job", {
  calendarSyncJobId: serial("calendar_sync_job_id").primaryKey(),
  calendarEventId: integer("calendar_event_id")
    .notNull()
    .references(() => calendarEvents.calendarEventId),
  targetCalendarId: varchar("target_calendar_id", { length: 255 }).notNull(),
  operation: varchar("operation", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("calendar_sync_job_due_idx").on(table.status, table.availableAt),
  uniqueIndex("calendar_sync_job_target_event_idx").on(
    table.calendarEventId,
    table.targetCalendarId,
  ),
]);
