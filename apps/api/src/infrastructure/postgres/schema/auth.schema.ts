import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  userId: uuid("user_id").defaultRandom().primaryKey(),
  kaistUid: varchar("kaist_uid", { length: 20 }).notNull().unique(),
  stdNo: varchar("std_no", { length: 20 }).unique(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
  departmentKo: varchar("dept_ko", { length: 100 }),
  departmentEn: varchar("dept_en", { length: 100 }),
  primaryMajor: varchar("primary_major", { length: 100 }),
  doubleMajor: varchar("double_major", { length: 100 }),
  minor: varchar("minor", { length: 100 }),
  gender: varchar("gender", { length: 20 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  academicStatus: varchar("academic_status", { length: 20 }),
  identityCode: varchar("identity_code", { length: 10 }),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("users_active_name_idx").on(table.isActive, table.nameKo),
]);

export const permissions = pgTable("permission", {
  permissionId: serial("permission_id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  bitValue: bigint("bit_value", { mode: "number" }).notNull().unique(),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  nameEn: varchar("name_en", { length: 100 }),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roleGroups = pgTable("role_group", {
  roleGroupId: serial("role_group_id").primaryKey(),
  nameKo: varchar("name_ko", { length: 100 }).notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roleGroupPermissions = pgTable("role_group_permission", {
  roleGroupId: integer("role_group_id")
    .notNull()
    .references(() => roleGroups.roleGroupId),
  permissionId: integer("permission_id")
    .notNull()
    .references(() => permissions.permissionId),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roleGroupId, table.permissionId] }),
]);

export const userRoleGroups = pgTable("user_role_group", {
  userRoleGroupId: serial("user_role_group_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  roleGroupId: integer("role_group_id")
    .notNull()
    .references(() => roleGroups.roleGroupId),
  grantedBy: uuid("granted_by")
    .references(() => users.userId),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [
  index("user_role_group_user_active_idx").on(table.userId, table.isActive),
  index("user_role_group_role_active_idx").on(table.roleGroupId, table.isActive),
]);
