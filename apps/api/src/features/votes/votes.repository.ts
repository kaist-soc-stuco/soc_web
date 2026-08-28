import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { CreateVoteRequest, UpdateVoteRequest, VoteVoterRecord } from "@soc/contracts";
import { isoToDate, msToDate, nowDate, nowMs } from "@soc/shared";

import { DRIZZLE_DB, type PostgresDatabase, type PostgresTransaction } from "../../infrastructure/postgres/postgres.provider";
import {
  studentFeeStatus,
  users,
  voteBallots,
  voteItems,
  voteOptions,
  voteTallies,
  voteVoters,
  votes,
} from "../../infrastructure/postgres/postgres.schema";

const schoolOfComputingPrimaryMajor = sql`(
  ${users.primaryMajor} ilike '%전산학부%'
  or ${users.primaryMajor} ilike '%전산학과%'
  or ${users.primaryMajor} ilike '%school of computing%'
  or ${users.primaryMajor} ilike '%computer science%'
)`;

@Injectable()
export class VotesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  transaction<T>(callback: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  async list(publicOnly = false) {
    const condition = publicOnly ? sql`${votes.status} <> 'DRAFT'` : undefined;
    return this.db
      .select({
        vote: votes,
        eligibleCount: sql<number>`(select count(*)::int from ${voteVoters} vv where vv.vote_id = ${votes.voteId} and vv.status = 'ELIGIBLE')`,
        votedCount: sql<number>`(select count(*)::int from ${voteVoters} vv where vv.vote_id = ${votes.voteId} and vv.status = 'ELIGIBLE' and vv.has_voted = true)`,
      })
      .from(votes)
      .where(condition)
      .orderBy(desc(votes.createdAt));
  }

  async findVote(id: string, tx?: PostgresTransaction) {
    const db = tx ?? this.db;
    const [row] = await db.select().from(votes).where(eq(votes.voteId, id)).limit(1);
    return row ?? null;
  }

  async findDefinition(id: string, tx?: PostgresTransaction) {
    const db = tx ?? this.db;
    const items = await db.select().from(voteItems).where(eq(voteItems.voteId, id)).orderBy(asc(voteItems.sortOrder));
    if (items.length === 0) return [];
    const options = await db.select().from(voteOptions).where(inArray(voteOptions.itemId, items.map((item) => item.itemId))).orderBy(asc(voteOptions.sortOrder));
    return items.map((item) => ({
      ...item,
      options: options.filter((option) => option.itemId === item.itemId),
    }));
  }

  async counts(id: string, tx?: PostgresTransaction) {
    const db = tx ?? this.db;
    const [row] = await db.select({
      eligibleCount: sql<number>`count(*) filter (where ${voteVoters.status} = 'ELIGIBLE')::int`,
      votedCount: sql<number>`count(*) filter (where ${voteVoters.status} = 'ELIGIBLE' and ${voteVoters.hasVoted} = true)::int`,
    }).from(voteVoters).where(eq(voteVoters.voteId, id));
    return row ?? { eligibleCount: 0, votedCount: 0 };
  }

  async create(creatorId: string, input: CreateVoteRequest) {
    return this.transaction(async (tx) => {
      const [vote] = await tx.insert(votes).values({
        creatorId,
        titleKo: input.titleKo,
        titleEn: input.titleEn ?? null,
        descriptionKo: input.descriptionKo ?? null,
        descriptionEn: input.descriptionEn ?? null,
        startsAt: isoToDate(input.startsAt),
        endsAt: isoToDate(input.endsAt),
        academicStatuses: input.academicStatuses,
        feePayersOnly: input.feePayersOnly,
        studentNumberFrom: input.studentNumberFrom ?? null,
        studentNumberTo: input.studentNumberTo ?? null,
      }).returning();
      await this.replaceDefinition(vote.voteId, input.items, tx);
      return vote;
    });
  }

  async updateDraft(id: string, input: UpdateVoteRequest) {
    return this.transaction(async (tx) => {
      const values: Partial<typeof votes.$inferInsert> = { updatedAt: nowDate() };
      if (input.titleKo !== undefined) values.titleKo = input.titleKo;
      if (input.titleEn !== undefined) values.titleEn = input.titleEn ?? null;
      if (input.descriptionKo !== undefined) values.descriptionKo = input.descriptionKo ?? null;
      if (input.descriptionEn !== undefined) values.descriptionEn = input.descriptionEn ?? null;
      if (input.startsAt !== undefined) values.startsAt = isoToDate(input.startsAt);
      if (input.endsAt !== undefined) values.endsAt = isoToDate(input.endsAt);
      if (input.academicStatuses !== undefined) values.academicStatuses = input.academicStatuses;
      if (input.feePayersOnly !== undefined) values.feePayersOnly = input.feePayersOnly;
      if (input.studentNumberFrom !== undefined) values.studentNumberFrom = input.studentNumberFrom ?? null;
      if (input.studentNumberTo !== undefined) values.studentNumberTo = input.studentNumberTo ?? null;
      const [vote] = await tx.update(votes).set(values).where(and(eq(votes.voteId, id), eq(votes.status, "DRAFT"))).returning();
      if (vote && input.items) await this.replaceDefinition(id, input.items, tx);
      return vote ?? null;
    });
  }

  private async replaceDefinition(id: string, items: CreateVoteRequest["items"], tx: PostgresTransaction) {
    await tx.delete(voteItems).where(eq(voteItems.voteId, id));
    for (const [itemIndex, item] of items.entries()) {
      const [createdItem] = await tx.insert(voteItems).values({
        voteId: id,
        titleKo: item.titleKo,
        titleEn: item.titleEn ?? null,
        descriptionKo: item.descriptionKo ?? null,
        descriptionEn: item.descriptionEn ?? null,
        type: item.type,
        maxSelections: item.maxSelections,
        sortOrder: itemIndex,
      }).returning();
      await tx.insert(voteOptions).values(item.options.map((option, optionIndex) => ({
        itemId: createdItem.itemId,
        labelKo: option.labelKo,
        labelEn: option.labelEn ?? null,
        descriptionKo: option.descriptionKo ?? null,
        descriptionEn: option.descriptionEn ?? null,
        imageUrl: option.imageUrl ?? null,
        sortOrder: optionIndex,
      })));
    }
  }

  async deleteDraft(id: string) {
    const rows = await this.db.delete(votes).where(and(eq(votes.voteId, id), eq(votes.status, "DRAFT"))).returning({ id: votes.voteId });
    return rows.length > 0;
  }

  async snapshotPrimaryMajorVoters(vote: typeof votes.$inferSelect, encryptedKey: { ciphertext: string; iv: string; authTag: string }) {
    return this.transaction(async (tx) => {
      const [published] = await tx.update(votes).set({
        status: "PUBLISHED",
        voterSnapshotAt: nowDate(),
        encryptedBallotKey: encryptedKey.ciphertext,
        keyIv: encryptedKey.iv,
        keyTag: encryptedKey.authTag,
        updatedAt: nowDate(),
      }).where(and(eq(votes.voteId, vote.voteId), eq(votes.status, "DRAFT"))).returning();
      if (!published) return { published: null, eligibleCount: 0 };

      const conditions = [
        eq(users.isActive, true),
        schoolOfComputingPrimaryMajor,
      ];
      if (vote.academicStatuses.length > 0) conditions.push(inArray(users.academicStatus, vote.academicStatuses));
      if (vote.studentNumberFrom) conditions.push(sql`${users.stdNo} >= ${vote.studentNumberFrom}`);
      if (vote.studentNumberTo) conditions.push(sql`${users.stdNo} <= ${vote.studentNumberTo}`);
      if (vote.feePayersOnly) conditions.push(eq(studentFeeStatus.status, "PAID"));
      const eligible = await tx.select({ user: users, feeStatus: studentFeeStatus.status })
        .from(users)
        .leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
        .where(and(...conditions));
      if (eligible.length > 0) {
        await tx.insert(voteVoters).values(eligible.map(({ user, feeStatus }) => ({
          voteId: vote.voteId,
          userId: user.userId,
          nameKo: user.nameKo,
          studentNumber: user.stdNo,
          email: user.email,
          primaryMajor: user.primaryMajor,
          academicStatus: user.academicStatus,
          feeStatus: feeStatus ?? null,
          source: "FILTER",
        })));
      }
      return { published, eligibleCount: eligible.length };
    });
  }

  async findVoter(voteId: string, userId: string, tx?: PostgresTransaction) {
    const db = tx ?? this.db;
    const [row] = await db.select().from(voteVoters).where(and(eq(voteVoters.voteId, voteId), eq(voteVoters.userId, userId))).limit(1);
    return row ?? null;
  }

  async listVoters(voteId: string): Promise<VoteVoterRecord[]> {
    const rows = await this.db.select().from(voteVoters).where(eq(voteVoters.voteId, voteId)).orderBy(asc(voteVoters.nameKo));
    return rows.map((row) => ({
      userId: row.userId,
      nameKo: row.nameKo,
      studentNumber: row.studentNumber,
      email: row.email,
      primaryMajor: row.primaryMajor,
      academicStatus: row.academicStatus,
      feeStatus: row.feeStatus,
      status: row.status as VoteVoterRecord["status"],
      source: row.source as VoteVoterRecord["source"],
      hasVoted: row.hasVoted,
      votedAt: row.votedAt?.toISOString() ?? null,
    }));
  }

  async addVoters(voteId: string, userIds: string[], studentNumbers: string[] = []) {
    const selected = await this.db.select({ user: users, feeStatus: studentFeeStatus.status })
      .from(users).leftJoin(studentFeeStatus, eq(studentFeeStatus.userId, users.userId))
      .where(and(
        userIds.length > 0 && studentNumbers.length > 0
          ? or(inArray(users.userId, userIds), inArray(users.stdNo, studentNumbers))!
          : userIds.length > 0
            ? inArray(users.userId, userIds)
            : inArray(users.stdNo, studentNumbers),
        eq(users.isActive, true),
        schoolOfComputingPrimaryMajor,
      ));
    for (const { user, feeStatus } of selected) {
      await this.db.insert(voteVoters).values({
        voteId, userId: user.userId, nameKo: user.nameKo, studentNumber: user.stdNo,
        email: user.email, primaryMajor: user.primaryMajor, academicStatus: user.academicStatus,
        feeStatus: feeStatus ?? null, status: "ELIGIBLE", source: "MANUAL",
      }).onConflictDoUpdate({ target: [voteVoters.voteId, voteVoters.userId], set: { status: "ELIGIBLE", source: "MANUAL" } });
    }
    return selected.length;
  }

  async excludeVoters(voteId: string, userIds: string[]) {
    const changed = await this.db.update(voteVoters).set({ status: "EXCLUDED" })
      .where(and(eq(voteVoters.voteId, voteId), inArray(voteVoters.userId, userIds), eq(voteVoters.hasVoted, false)))
      .returning({ userId: voteVoters.userId });
    return changed.length;
  }

  async submitBallot(input: { voteId: string; userId: string; ciphertext: string; iv: string; authTag: string; receiptHash: string }) {
    return this.transaction(async (tx) => {
      await tx.execute(sql`select 1 from ${voteVoters} where ${voteVoters.voteId} = ${input.voteId} and ${voteVoters.userId} = ${input.userId} for update`);
      const voter = await this.findVoter(input.voteId, input.userId, tx);
      if (!voter || voter.status !== "ELIGIBLE" || voter.hasVoted) return false;
      await tx.insert(voteBallots).values({
        voteId: input.voteId,
        ciphertext: input.ciphertext,
        iv: input.iv,
        authTag: input.authTag,
        receiptHash: input.receiptHash,
      });
      const votedAtMinute = msToDate(Math.floor(nowMs() / 60_000) * 60_000);
      await tx.update(voteVoters).set({ hasVoted: true, votedAt: votedAtMinute })
        .where(and(eq(voteVoters.voteId, input.voteId), eq(voteVoters.userId, input.userId)));
      return true;
    });
  }

  async close(id: string) {
    const [row] = await this.db.update(votes).set({ status: "CLOSED", updatedAt: nowDate() })
      .where(and(eq(votes.voteId, id), eq(votes.status, "PUBLISHED"))).returning();
    return row ?? null;
  }

  async listBallots(id: string) {
    return this.db.select().from(voteBallots).where(eq(voteBallots.voteId, id));
  }

  async hasReceipt(voteId: string, receiptHash: string): Promise<boolean> {
    const [row] = await this.db.select({ ballotId: voteBallots.ballotId }).from(voteBallots)
      .where(and(eq(voteBallots.voteId, voteId), eq(voteBallots.receiptHash, receiptHash))).limit(1);
    return Boolean(row);
  }

  async saveTally(id: string, result: unknown, totalBallots: number) {
    const [tally] = await this.db.insert(voteTallies).values({ voteId: id, result, totalBallots })
      .onConflictDoUpdate({ target: voteTallies.voteId, set: { result, totalBallots, talliedAt: nowDate() } }).returning();
    await this.db.update(votes).set({ status: "TALLIED", updatedAt: nowDate() }).where(eq(votes.voteId, id));
    return tally;
  }

  async findTally(id: string) {
    const [row] = await this.db.select().from(voteTallies).where(eq(voteTallies.voteId, id)).limit(1);
    return row ?? null;
  }

  async publishResults(id: string) {
    const [row] = await this.db.update(votes).set({ resultsPublishedAt: nowDate(), updatedAt: nowDate() })
      .where(and(eq(votes.voteId, id), eq(votes.status, "TALLIED"), isNull(votes.resultsPublishedAt))).returning();
    return row ?? null;
  }
}
