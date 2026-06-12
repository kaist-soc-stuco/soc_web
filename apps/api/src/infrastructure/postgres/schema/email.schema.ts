import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

export const bulkEmails = pgTable("bulk_email", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  senderId: uuid("sender_id")
    .references(() => users.userId, { onDelete: "set null" }),
  recipientCount: integer("recipient_count").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bulk_email_sent_idx").on(table.sentAt),
  index("bulk_email_sender_sent_idx").on(table.senderId, table.sentAt),
]);
