import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./auth.schema";

export const votes = pgTable("vote", {
  voteId: uuid("vote_id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").references(() => users.userId, { onDelete: "set null" }),
  titleKo: varchar("title_ko", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  academicStatuses: jsonb("academic_statuses").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  feePayersOnly: boolean("fee_payers_only").notNull().default(false),
  studentNumberFrom: varchar("student_number_from", { length: 20 }),
  studentNumberTo: varchar("student_number_to", { length: 20 }),
  encryptedBallotKey: text("encrypted_ballot_key"),
  keyIv: varchar("key_iv", { length: 32 }),
  keyTag: varchar("key_tag", { length: 32 }),
  voterSnapshotAt: timestamp("voter_snapshot_at", { withTimezone: true }),
  resultsPublishedAt: timestamp("results_published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("vote_status_schedule_idx").on(table.status, table.startsAt, table.endsAt),
  check("vote_status_check", sql`${table.status} in ('DRAFT', 'PUBLISHED', 'CLOSED', 'TALLIED')`),
  check("vote_schedule_check", sql`${table.endsAt} > ${table.startsAt}`),
]);

export const voteItems = pgTable("vote_item", {
  itemId: uuid("item_id").defaultRandom().primaryKey(),
  voteId: uuid("vote_id").notNull().references(() => votes.voteId, { onDelete: "cascade" }),
  titleKo: text("title_ko").notNull(),
  titleEn: text("title_en"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  type: varchar("type", { length: 30 }).notNull(),
  maxSelections: integer("max_selections").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("vote_item_vote_sort_idx").on(table.voteId, table.sortOrder),
  check("vote_item_type_check", sql`${table.type} in ('YES_NO_ABSTAIN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE')`),
  check("vote_item_max_selection_check", sql`${table.maxSelections} >= 1`),
]);

export const voteOptions = pgTable("vote_option", {
  optionId: uuid("option_id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => voteItems.itemId, { onDelete: "cascade" }),
  labelKo: varchar("label_ko", { length: 255 }).notNull(),
  labelEn: varchar("label_en", { length: 255 }),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("vote_option_item_sort_idx").on(table.itemId, table.sortOrder),
]);

export const voteVoters = pgTable("vote_voter", {
  voteId: uuid("vote_id").notNull().references(() => votes.voteId, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.userId, { onDelete: "restrict" }),
  nameKo: varchar("name_ko", { length: 100 }).notNull(),
  studentNumber: varchar("student_number", { length: 20 }),
  email: varchar("email", { length: 255 }).notNull(),
  primaryMajor: varchar("primary_major", { length: 100 }),
  academicStatus: varchar("academic_status", { length: 30 }),
  feeStatus: varchar("fee_status", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("ELIGIBLE"),
  source: varchar("source", { length: 20 }).notNull().default("FILTER"),
  hasVoted: boolean("has_voted").notNull().default(false),
  votedAt: timestamp("voted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.voteId, table.userId] }),
  index("vote_voter_vote_status_idx").on(table.voteId, table.status, table.hasVoted),
  check("vote_voter_status_check", sql`${table.status} in ('ELIGIBLE', 'EXCLUDED')`),
  check("vote_voter_source_check", sql`${table.source} in ('FILTER', 'MANUAL', 'IMPORT')`),
]);

/** 암호문에는 사용자 식별자나 vote_voter FK를 두지 않습니다. */
export const voteBallots = pgTable("vote_ballot", {
  ballotId: uuid("ballot_id").defaultRandom().primaryKey(),
  voteId: uuid("vote_id").notNull().references(() => votes.voteId, { onDelete: "restrict" }),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("auth_tag", { length: 32 }).notNull(),
  receiptHash: varchar("receipt_hash", { length: 64 }).notNull(),
}, (table) => [
  index("vote_ballot_vote_idx").on(table.voteId),
  uniqueIndex("vote_ballot_receipt_unique_idx").on(table.receiptHash),
]);

export const voteTallies = pgTable("vote_tally", {
  voteId: uuid("vote_id").primaryKey().references(() => votes.voteId, { onDelete: "cascade" }),
  result: jsonb("result").notNull(),
  totalBallots: integer("total_ballots").notNull(),
  talliedAt: timestamp("tallied_at", { withTimezone: true }).notNull().defaultNow(),
});
