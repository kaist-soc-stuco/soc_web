import { SITE_CONTENT_KEYS } from "@soc/contracts";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
