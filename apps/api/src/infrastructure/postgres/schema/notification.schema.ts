import {
  boolean,
  index,
  text,
  timestamp,
  uuid,
  varchar,
  pgTable,
} from "drizzle-orm/pg-core";

import { users } from "./auth.schema";

export const notifications = pgTable(
  "notification",
  {
    notificationId: uuid("notification_id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.userId, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 40 }).notNull(),
    titleKo: varchar("title_ko", { length: 255 }).notNull(),
    bodyKo: text("body_ko"),
    link: varchar("link", { length: 500 }),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_created_idx").on(table.userId, table.createdAt),
    index("notification_user_unread_idx").on(table.userId, table.isRead, table.createdAt),
  ],
);
