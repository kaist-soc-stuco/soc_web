import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const executiveContacts = pgTable("executive_contact", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  roleKo: varchar("role_ko", { length: 100 }).notNull(),
  roleEn: varchar("role_en", { length: 100 }).notNull(),
  gender: varchar("gender", { length: 20 }),
  cohort: integer("cohort"),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  privacyConsented: boolean("privacy_consented").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("executive_contact_sort_idx").on(table.sortOrder),
]);
