import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const executiveContacts = pgTable("executive_contact", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  departmentKo: varchar("department_ko", { length: 100 }),
  departmentEn: varchar("department_en", { length: 100 }),
  roleKo: varchar("role_ko", { length: 100 }).notNull(),
  roleEn: varchar("role_en", { length: 100 }).notNull(),
  studentNumber: varchar("student_number", { length: 30 }),
  avatarStorageKey: varchar("avatar_storage_key", { length: 255 }),
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

export const executiveContactDepartments = pgTable("executive_contact_department", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }).notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("executive_contact_department_name_ko_uq").on(table.nameKo),
  index("executive_contact_department_sort_idx").on(table.sortOrder),
]);
