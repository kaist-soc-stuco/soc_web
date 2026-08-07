import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import {
  permissionAuditLog,
  pledges,
  voteBallots,
  voteCandidates,
  voteParticipants,
  voteVoterRolls,
  votes,
} from '../../infrastructure/postgres/postgres.schema';

export type VoteRow = typeof votes.$inferSelect;
export type VoteCandidateRow = typeof voteCandidates.$inferSelect;
export type PledgeRow = typeof pledges.$inferSelect;

export interface VoteBundle {
  vote: VoteRow;
  candidates: VoteCandidateRow[];
}

export interface VoteStats {
  eligibleVoterCount: number;
  participantCount: number;
}

export interface VoteResultRow {
  candidateId: string;
  voteCount: number;
}

@Injectable()
export class GovernanceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async listVotes(): Promise<VoteBundle[]> {
    const rows = await this.db.select().from(votes).orderBy(desc(votes.createdAt), desc(votes.id));
    return this.withCandidates(rows);
  }

  async findVote(id: string): Promise<VoteBundle | null> {
    const [vote] = await this.db.select().from(votes).where(eq(votes.id, id)).limit(1);
    if (!vote) return null;
    const candidates = await this.db.select().from(voteCandidates)
      .where(eq(voteCandidates.voteId, id))
      .orderBy(asc(voteCandidates.ordinal), asc(voteCandidates.id));
    return { vote, candidates };
  }

  async stats(voteId: string): Promise<VoteStats> {
    const [eligible] = await this.db.select({ count: sql<number>`count(*)` })
      .from(voteVoterRolls).where(eq(voteVoterRolls.voteId, voteId));
    const [participants] = await this.db.select({ count: sql<number>`count(*)` })
      .from(voteParticipants).where(eq(voteParticipants.voteId, voteId));
    return { eligibleVoterCount: Number(eligible?.count ?? 0), participantCount: Number(participants?.count ?? 0) };
  }

  async results(voteId: string): Promise<VoteResultRow[]> {
    const rows = await this.db.select({ candidateId: voteBallots.candidateId, count: sql<number>`count(*)` })
      .from(voteBallots)
      .where(eq(voteBallots.voteId, voteId))
      .groupBy(voteBallots.candidateId);
    return rows.map((row) => ({ candidateId: row.candidateId, voteCount: Number(row.count) }));
  }

  async isEligible(voteId: string, hashes: string[]): Promise<boolean> {
    if (hashes.length === 0) return false;
    const [row] = await this.db.select({ id: voteVoterRolls.id })
      .from(voteVoterRolls)
      .where(and(eq(voteVoterRolls.voteId, voteId), inArray(voteVoterRolls.identityHash, hashes)))
      .limit(1);
    return Boolean(row);
  }

  async hasParticipant(voteId: string, userId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: voteParticipants.id })
      .from(voteParticipants)
      .where(and(eq(voteParticipants.voteId, voteId), eq(voteParticipants.userId, userId)))
      .limit(1);
    return Boolean(row);
  }

  async createVote(input: {
    vote: typeof votes.$inferInsert;
    candidates: Array<Omit<typeof voteCandidates.$inferInsert, 'voteId'>>;
    actorUserId: string;
  }): Promise<VoteBundle> {
    return this.db.transaction(async (tx) => {
      const [vote] = await tx.insert(votes).values(input.vote).returning();
      const candidates = input.candidates.length > 0
        ? await tx.insert(voteCandidates).values(input.candidates.map((candidate) => ({ ...candidate, voteId: vote.id }))).returning()
        : [];
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'VOTE_CREATED',
        recordId: vote.id,
        changedFieldNames: 'title,description,time,turnout,candidates',
        correlationId: vote.id,
        reasonCode: 'VOTE_ADMIN',
      });
      return { vote, candidates: candidates.sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id)) };
    });
  }

  async patchVote(id: string, actorUserId: string, values: Partial<typeof votes.$inferInsert>, changedFieldNames: string): Promise<VoteBundle | null | 'IMMUTABLE'> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(votes).where(eq(votes.id, id)).for('update');
      if (!current) return null;
      if (['CLOSED', 'DISCARDED', 'RESULTS_PUBLISHED', 'RESULTS_RETIRED'].includes(current.state)) return 'IMMUTABLE';
      const [updated] = await tx.update(votes).set(values).where(eq(votes.id, id)).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'VOTE_UPDATED',
        recordId: updated.id,
        changedFieldNames,
        correlationId: updated.id,
        reasonCode: 'VOTE_ADMIN',
      });
      const candidates = await tx.select().from(voteCandidates).where(eq(voteCandidates.voteId, id)).orderBy(asc(voteCandidates.ordinal), asc(voteCandidates.id));
      return { vote: updated, candidates };
    });
  }

  async replaceVoterRoll(
    id: string,
    actorUserId: string,
    entries: Array<{ identityKind: 'SSO_SUBJECT' | 'STUDENT_NUMBER'; identityHash: string }>,
  ): Promise<'MISSING' | 'IMMUTABLE' | VoteBundle> {
    return this.db.transaction(async (tx) => {
      const [vote] = await tx.select().from(votes).where(eq(votes.id, id)).for('update');
      if (!vote) return 'MISSING';
      if (!['DRAFT', 'SCHEDULED'].includes(vote.state)) return 'IMMUTABLE';
      await tx.delete(voteVoterRolls).where(eq(voteVoterRolls.voteId, id));
      if (entries.length > 0) await tx.insert(voteVoterRolls).values(entries.map((entry) => ({ voteId: id, ...entry })));
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'VOTE_VOTER_ROLL_REPLACED',
        recordId: id,
        changedFieldNames: 'voterRoll',
        correlationId: id,
        reasonCode: 'VOTE_ADMIN',
      });
      const candidates = await tx.select().from(voteCandidates).where(eq(voteCandidates.voteId, id)).orderBy(asc(voteCandidates.ordinal), asc(voteCandidates.id));
      return { vote, candidates };
    });
  }

  async transition(id: string, actorUserId: string, action: 'OPEN' | 'CLOSE' | 'PUBLISH', now: Date): Promise<'MISSING' | 'INVALID_STATE' | 'INVALID_TURNOUT' | VoteBundle> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(votes).where(eq(votes.id, id)).for('update');
      if (!current) return 'MISSING';
      const candidateRows = await tx.select().from(voteCandidates).where(eq(voteCandidates.voteId, id));
      if (action === 'OPEN') {
        if (!['DRAFT', 'SCHEDULED'].includes(current.state) || candidateRows.length < 2) return 'INVALID_STATE';
        const [roll] = await tx.select({ count: sql<number>`count(*)` }).from(voteVoterRolls).where(eq(voteVoterRolls.voteId, id));
        if (Number(roll?.count ?? 0) === 0) return 'INVALID_STATE';
        const state = current.opensAt > now ? 'SCHEDULED' : 'OPEN';
        const [updated] = await tx.update(votes).set({ state, updatedByUserId: actorUserId, updatedAt: now }).where(eq(votes.id, id)).returning();
        await this.audit(tx, actorUserId, 'VOTE_OPENED', id, 'state', id);
        return { vote: updated, candidates: candidateRows };
      }

      if (action === 'CLOSE') {
        if (!['OPEN', 'SCHEDULED'].includes(current.state)) return 'INVALID_STATE';
        const [roll] = await tx.select({ count: sql<number>`count(*)` }).from(voteVoterRolls).where(eq(voteVoterRolls.voteId, id));
        const [participants] = await tx.select({ count: sql<number>`count(*)` }).from(voteParticipants).where(eq(voteParticipants.voteId, id));
        const eligibleCount = Number(roll?.count ?? 0);
        const participantCount = Number(participants?.count ?? 0);
        const turnout = eligibleCount === 0 ? 0 : participantCount / eligibleCount * 100;
        const state = turnout >= current.validTurnoutPercent ? 'CLOSED' : 'DISCARDED';
        const [updated] = await tx.update(votes).set({ state, closesAt: current.closesAt > now ? now : current.closesAt, updatedByUserId: actorUserId, updatedAt: now }).where(eq(votes.id, id)).returning();
        await this.audit(tx, actorUserId, state === 'CLOSED' ? 'VOTE_CLOSED' : 'VOTE_DISCARDED', id, 'state,closesAt', id);
        return { vote: updated, candidates: candidateRows };
      }

      if (current.state !== 'CLOSED') return 'INVALID_STATE';
      const [roll] = await tx.select({ count: sql<number>`count(*)` }).from(voteVoterRolls).where(eq(voteVoterRolls.voteId, id));
      const [participants] = await tx.select({ count: sql<number>`count(*)` }).from(voteParticipants).where(eq(voteParticipants.voteId, id));
      const eligibleCount = Number(roll?.count ?? 0);
      const participantCount = Number(participants?.count ?? 0);
      if (eligibleCount === 0 || participantCount / eligibleCount * 100 < current.validTurnoutPercent) {
        await tx.update(votes).set({ state: 'DISCARDED', updatedByUserId: actorUserId, updatedAt: now }).where(eq(votes.id, id));
        await this.audit(tx, actorUserId, 'VOTE_DISCARDED', id, 'state', id);
        return 'INVALID_TURNOUT';
      }
      const visibleUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const [updated] = await tx.update(votes).set({ state: 'RESULTS_PUBLISHED', resultsPublishedAt: now, resultsVisibleUntil: visibleUntil, updatedByUserId: actorUserId, updatedAt: now }).where(eq(votes.id, id)).returning();
      await this.audit(tx, actorUserId, 'VOTE_RESULTS_PUBLISHED', id, 'state,resultsPublishedAt,resultsVisibleUntil', id);
      return { vote: updated, candidates: candidateRows };
    });
  }

  async castVote(voteId: string, userId: string, candidateId: string, now: Date): Promise<'MISSING' | 'CLOSED' | 'CANDIDATE' | 'ALREADY_VOTED' | 'OK'> {
    return this.db.transaction(async (tx) => {
      const [vote] = await tx.select().from(votes).where(eq(votes.id, voteId)).for('update');
      if (!vote) return 'MISSING';
      // A vote opened for a future date is persisted as SCHEDULED. Once the
      // start time arrives it must be castable even if no admin request has
      // come in to flip the persisted state to OPEN.
      if (!['OPEN', 'SCHEDULED'].includes(vote.state) || vote.opensAt > now || vote.closesAt <= now) return 'CLOSED';
      const [candidate] = await tx.select({ id: voteCandidates.id }).from(voteCandidates).where(and(eq(voteCandidates.id, candidateId), eq(voteCandidates.voteId, voteId))).limit(1);
      if (!candidate) return 'CANDIDATE';
      const [existing] = await tx.select({ id: voteParticipants.id }).from(voteParticipants).where(and(eq(voteParticipants.voteId, voteId), eq(voteParticipants.userId, userId))).limit(1);
      if (existing) return 'ALREADY_VOTED';
      const [participant] = await tx.insert(voteParticipants).values({ voteId, userId, votedAt: now }).onConflictDoNothing({ target: [voteParticipants.voteId, voteParticipants.userId] }).returning();
      if (!participant) return 'ALREADY_VOTED';
      await tx.insert(voteBallots).values({ voteId, candidateId, createdAt: now });
      return 'OK';
    });
  }

  async listPledges(publicOnly: boolean): Promise<PledgeRow[]> {
    return this.db.select().from(pledges)
      .where(publicOnly ? eq(pledges.isPublished, true) : undefined)
      .orderBy(asc(pledges.ordinal), asc(pledges.id));
  }

  async findPledge(id: string): Promise<PledgeRow | null> {
    const [row] = await this.db.select().from(pledges).where(eq(pledges.id, id)).limit(1);
    return row ?? null;
  }

  async createPledge(input: typeof pledges.$inferInsert, actorUserId: string): Promise<PledgeRow> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(pledges).values(input).returning();
      await this.audit(tx, actorUserId, 'PLEDGE_CREATED', created.id, 'record', created.id);
      return created;
    });
  }

  async patchPledge(id: string, actorUserId: string, values: Partial<typeof pledges.$inferInsert>, changedFieldNames: string): Promise<PledgeRow | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(pledges).where(eq(pledges.id, id)).for('update');
      if (!current) return null;
      const [updated] = await tx.update(pledges).set(values).where(eq(pledges.id, id)).returning();
      await this.audit(tx, actorUserId, 'PLEDGE_UPDATED', id, changedFieldNames, id);
      return updated;
    });
  }

  private async withCandidates(rows: VoteRow[]): Promise<VoteBundle[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const candidateRows = await this.db.select().from(voteCandidates).where(inArray(voteCandidates.voteId, ids)).orderBy(asc(voteCandidates.ordinal), asc(voteCandidates.id));
    const byVote = new Map<string, VoteCandidateRow[]>();
    for (const candidate of candidateRows) byVote.set(candidate.voteId, [...(byVote.get(candidate.voteId) ?? []), candidate]);
    return rows.map((vote) => ({ vote, candidates: byVote.get(vote.id) ?? [] }));
  }

  private async audit(tx: any, actorUserId: string, action: string, recordId: string, changedFieldNames: string, correlationId: string): Promise<void> {
    await tx.insert(permissionAuditLog).values({ actorUserId, action, recordId, changedFieldNames, correlationId, reasonCode: 'GOVERNANCE_ADMIN' });
  }
}
