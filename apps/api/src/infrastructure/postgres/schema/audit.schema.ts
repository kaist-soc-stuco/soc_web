import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

export const auditLogs = pgTable("audit_log", {
  auditLogId: serial("audit_log_id").primaryKey(),
  actorUserId: uuid("actor_user_id")
    .references(() => users.userId),
  action: varchar("action", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 50 }),
  payload: text("payload"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_log_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("audit_log_target_created_idx").on(
    table.targetType,
    table.targetId,
    table.createdAt,
  ),
]);
