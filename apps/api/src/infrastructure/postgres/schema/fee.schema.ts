import {
  index,
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
  coverageSemesters: smallint("coverage_semesters").notNull().default(4),
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
