import {
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

export const studentFeeStatus = pgTable("student_fee_status", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.userId),
  coverageSemesters: smallint("coverage_semesters").notNull().default(6),
  paidAmount: integer("paid_amount").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by")
    .references(() => users.userId),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("student_fee_status_status_updated_idx").on(
    table.status,
    table.updatedAt,
  ),
]);

/**
 * 납부 원장. student_fee_status는 레거시 세션/요약 호환용으로 유지하고,
 * 실제 납부 이벤트와 학기 적용 범위는 이 테이블에 한 건씩 보존합니다.
 */
export const studentFeePayments = pgTable("student_fee_payment", {
  paymentId: uuid("payment_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  amount: integer("amount").notNull().default(0),
  paymentType: varchar("payment_type", { length: 40 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
  effectiveStartSemester: varchar("effective_start_semester", { length: 7 }).notNull(),
  coverageSemesters: smallint("coverage_semesters").notNull().default(6),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  note: text("note"),
  recordedBy: uuid("recorded_by").references(() => users.userId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("student_fee_payment_user_paid_idx").on(table.userId, table.paidAt),
  index("student_fee_payment_semester_idx").on(table.effectiveStartSemester),
]);

/**
 * OAuth secret 파일로 생성한 과비 관리용 Google Spreadsheet의 위치만 저장합니다.
 * Google credential/token은 DB에 복제하지 않습니다.
 */
export const studentFeeGoogleSheetsIntegration = pgTable("student_fee_google_sheets_integration", {
  integrationKey: varchar("integration_key", { length: 40 }).primaryKey(),
  spreadsheetId: varchar("spreadsheet_id", { length: 255 }).notNull(),
  spreadsheetUrl: varchar("spreadsheet_url", { length: 2000 }).notNull(),
  createdBy: uuid("created_by").references(() => users.userId),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
