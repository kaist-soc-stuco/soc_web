import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./auth.schema";

export const roadmapCourses = pgTable(
  "roadmap_course",
  {
    courseId: uuid("course_id").defaultRandom().primaryKey(),
    courseCode: varchar("course_code", { length: 64 }).notNull(),
    legacyCourseCode: varchar("legacy_course_code", { length: 64 }),
    nameKo: text("name_ko").notNull(),
    nameEn: text("name_en").notNull().default(""),
    category: varchar("category", { length: 32 }).notNull().default("major-elective"),
    credits: varchar("credits", { length: 40 }).notNull().default(""),
    semesters: varchar("semesters", { length: 20 }).notNull().default("S/F"),
    trackIds: jsonb("track_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ai: boolean("ai").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    source: varchar("source", { length: 20 }).notNull().default("MANUAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("roadmap_course_code_uq").on(table.courseCode),
    index("roadmap_course_legacy_code_idx").on(table.legacyCourseCode),
    index("roadmap_course_visible_idx").on(table.isVisible),
  ],
);

export const roadmapCourseRelations = pgTable(
  "roadmap_course_relation",
  {
    relationId: uuid("relation_id").defaultRandom().primaryKey(),
    prerequisiteCourseId: uuid("prerequisite_course_id")
      .notNull()
      .references(() => roadmapCourses.courseId, { onDelete: "cascade" }),
    postrequisiteCourseId: uuid("postrequisite_course_id")
      .notNull()
      .references(() => roadmapCourses.courseId, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("roadmap_course_relation_pair_uq").on(
      table.prerequisiteCourseId,
      table.postrequisiteCourseId,
    ),
    index("roadmap_course_relation_target_idx").on(table.postrequisiteCourseId),
  ],
);

export const roadmapTerms = pgTable(
  "roadmap_term",
  {
    termId: uuid("term_id").defaultRandom().primaryKey(),
    term: varchar("term", { length: 32 }).notNull(),
    sourceFileName: varchar("source_file_name", { length: 255 }),
    importedBy: uuid("imported_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("roadmap_term_term_uq").on(table.term),
    index("roadmap_term_imported_idx").on(table.importedAt),
  ],
);

export const roadmapOfferings = pgTable(
  "roadmap_offering",
  {
    offeringId: uuid("offering_id").defaultRandom().primaryKey(),
    term: varchar("term", { length: 32 }).notNull(),
    courseCode: varchar("course_code", { length: 64 }).notNull(),
    currentCode: varchar("current_code", { length: 64 }).notNull(),
    nameKo: text("name_ko").notNull(),
    section: varchar("section", { length: 30 }),
    instructor: text("instructor"),
    credits: varchar("credits", { length: 40 }),
    time: text("time"),
    room: text("room"),
    capacity: integer("capacity"),
    enrolled: integer("enrolled"),
    delivery: varchar("delivery", { length: 80 }),
    inEnglish: boolean("in_english").notNull().default(false),
    sourceData: jsonb("source_data").$type<Record<string, unknown>>().notNull(),
    sourceFileName: varchar("source_file_name", { length: 255 }),
    importedBy: uuid("imported_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("roadmap_offering_term_idx").on(table.term),
    index("roadmap_offering_course_idx").on(table.courseCode),
    index("roadmap_offering_import_idx").on(table.importedAt),
  ],
);
