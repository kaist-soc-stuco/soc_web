import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  ssoUserId: text("sso_user_id").notNull().unique(),
  permission: integer("permission").notNull().default(0),
  userEmail: text("user_email"),
  userMobile: text("user_mobile"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
