import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AdminPledge,
  AdminPledgeListResponse,
  AdminVote,
  AdminVoteListResponse,
  CastVoteResponse,
  ContentLocale,
  CreatePledgeRequest,
  CreateVoteRequest,
  ImportVoteVoterRollRequest,
  LocalizedContent,
  PatchPledgeRequest,
  PatchVoteRequest,
  Pledge,
  PledgeListResponse,
  VoteCandidate,
  VoteDetail,
  VoteListResponse,
  VoteParticipationState,
  VoteResult,
  VoteState,
} from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { UsersService } from '../users/users.service';
import { GovernanceRepository, type PledgeRow, type VoteBundle, type VoteCandidateRow, type VoteRow } from './governance.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 20_000;
const VOTE_STATES: VoteState[] = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'DISCARDED', 'RESULTS_PUBLISHED', 'RESULTS_RETIRED'];
const PLEDGE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;

@Injectable()
export class GovernanceService {
  constructor(
    private readonly repository: GovernanceRepository,
    private readonly permissions: PermissionsService,
    private readonly users: UsersService,
    private readonly clock: Clock,
  ) {}

  async listVotes(actorUserId: string | undefined, localeValue: unknown): Promise<VoteListResponse> {
    const locale = this.locale(localeValue);
    const bundles = await this.repository.listVotes();
    const identity = actorUserId ? await this.identityHashes(actorUserId) : null;
    const items = [];
    for (const bundle of bundles) {
      const state = this.effectiveState(bundle.vote, this.clock.now());
      if (!['SCHEDULED', 'OPEN', 'CLOSED', 'RESULTS_PUBLISHED'].includes(state)) continue;
      items.push(await this.summary(bundle, locale, actorUserId, identity, state));
    }
    return { locale, items };
  }

  async getVote(actorUserId: string | undefined, id: string, localeValue: unknown): Promise<VoteDetail> {
    this.uuid(id);
    const locale = this.locale(localeValue);
    const bundle = await this.repository.findVote(id);
    if (!bundle) throw new NotFoundException('vote_not_found');
    const now = this.clock.now();
    const state = this.effectiveState(bundle.vote, now);
    if (['DRAFT', 'DISCARDED'].includes(state)) throw new NotFoundException('vote_not_found');
    const identity = actorUserId ? await this.identityHashes(actorUserId) : null;
    const summary = await this.summary(bundle, locale, actorUserId, identity, state);
    const results = state === 'RESULTS_PUBLISHED' && bundle.vote.resultsVisibleUntil && bundle.vote.resultsVisibleUntil > now
      ? await this.resultDtos(bundle.candidates, await this.repository.results(id), locale)
      : null;
    return { ...summary, candidates: bundle.candidates.map((candidate) => this.candidate(candidate, locale)), results };
  }

  async castVote(actorUserId: string, id: string, candidateId: string): Promise<CastVoteResponse> {
    this.uuid(id);
    this.uuid(candidateId);
    const identity = await this.identityHashes(actorUserId);
    const bundle = await this.repository.findVote(id);
    if (!bundle) throw new NotFoundException('vote_not_found');
    const state = this.effectiveState(bundle.vote, this.clock.now());
    if (state !== 'OPEN') throw new ConflictException('vote_closed');
    if (!await this.repository.isEligible(id, identity.hashes)) throw new ForbiddenException('vote_not_eligible');
    const result = await this.repository.castVote(id, actorUserId, candidateId, this.clock.now());
    if (result === 'MISSING') throw new NotFoundException('vote_not_found');
    if (result === 'CLOSED') throw new ConflictException('vote_closed');
    if (result === 'CANDIDATE') throw new UnprocessableEntityException('invalid_vote_candidate');
    if (result === 'ALREADY_VOTED') throw new ConflictException('vote_already_cast');
    const stats = await this.repository.stats(id);
    return { voted: true, turnoutPercent: this.turnout(stats.participantCount, stats.eligibleVoterCount) };
  }

  async listAdminVotes(actorUserId: string): Promise<AdminVoteListResponse> {
    await this.require(actorUserId, 'VOTE_MANAGE');
    const bundles = await this.repository.listVotes();
    return { items: await Promise.all(bundles.map((bundle) => this.adminVote(bundle))) };
  }

  async createVote(actorUserId: string, input: CreateVoteRequest): Promise<AdminVote> {
    await this.require(actorUserId, 'VOTE_MANAGE');
    const value = this.validateCreateVote(input);
    const created = await this.repository.createVote({
      actorUserId,
      vote: {
        titleKr: value.titleKr,
        titleEn: value.titleEn,
        descriptionKr: value.descriptionKr,
        descriptionEn: value.descriptionEn,
        state: 'DRAFT',
        opensAt: value.opensAt,
        closesAt: value.closesAt,
        anonymous: value.anonymous,
        validTurnoutPercent: value.validTurnoutPercent,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      candidates: value.candidates.map((candidate, ordinal) => ({ ...candidate, ordinal })),
    });
    return this.adminVote(created);
  }

  async patchVote(actorUserId: string, id: string, input: PatchVoteRequest): Promise<AdminVote> {
    await this.require(actorUserId, 'VOTE_MANAGE');
    this.uuid(id);
    const current = await this.repository.findVote(id);
    if (!current) throw new NotFoundException('vote_not_found');
    const value = this.validatePatchVote(input, current.vote);
    const changed = Object.keys(input).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)).join(',') || 'record';
    const updated = await this.repository.patchVote(id, actorUserId, value, changed);
    if (!updated) throw new NotFoundException('vote_not_found');
    if (updated === 'IMMUTABLE') throw new ConflictException('vote_immutable');
    return this.adminVote(updated);
  }

  async importVoterRoll(actorUserId: string, id: string, input: ImportVoteVoterRollRequest): Promise<AdminVote> {
    await this.require(actorUserId, 'VOTE_MANAGE');
    this.uuid(id);
    if (!input || !Array.isArray(input.entries) || input.entries.length === 0 || input.entries.length > 20_000) throw new UnprocessableEntityException('invalid_voter_roll');
    const values = input.entries.map((entry) => {
      if (!entry || (entry.identityKind !== 'SSO_SUBJECT' && entry.identityKind !== 'STUDENT_NUMBER') || typeof entry.value !== 'string') throw new UnprocessableEntityException('invalid_voter_roll');
      const normalized = this.normalizeIdentity(entry.value);
      if (!normalized || normalized.length > 128) throw new UnprocessableEntityException('invalid_voter_roll');
      return { identityKind: entry.identityKind, identityHash: this.hashIdentity(entry.identityKind, normalized) };
    });
    const unique = [...new Map(values.map((entry) => [`${entry.identityKind}:${entry.identityHash}`, entry])).values()];
    const updated = await this.repository.replaceVoterRoll(id, actorUserId, unique);
    if (updated === 'MISSING') throw new NotFoundException('vote_not_found');
    if (updated === 'IMMUTABLE') throw new ConflictException('vote_immutable');
    return this.adminVote(updated);
  }

  async transition(actorUserId: string, id: string, action: 'OPEN' | 'CLOSE' | 'PUBLISH'): Promise<AdminVote> {
    await this.require(actorUserId, 'VOTE_MANAGE');
    this.uuid(id);
    const result = await this.repository.transition(id, actorUserId, action, this.clock.now());
    if (result === 'MISSING') throw new NotFoundException('vote_not_found');
    if (result === 'INVALID_STATE') throw new ConflictException('vote_invalid_state');
    if (result === 'INVALID_TURNOUT') throw new ConflictException('vote_invalid_turnout');
    return this.adminVote(result);
  }

  async listPledges(localeValue: unknown): Promise<PledgeListResponse> {
    const locale = this.locale(localeValue);
    return { locale, items: (await this.repository.listPledges(true)).map((row) => this.pledge(row, locale)) };
  }

  async getPledge(id: string, localeValue: unknown): Promise<Pledge> {
    this.uuid(id);
    const row = await this.repository.findPledge(id);
    if (!row || !row.isPublished) throw new NotFoundException('pledge_not_found');
    return this.pledge(row, this.locale(localeValue));
  }

  async listAdminPledges(actorUserId: string): Promise<AdminPledgeListResponse> {
    await this.require(actorUserId, 'PLEDGE_MANAGE');
    return { items: (await this.repository.listPledges(false)).map((row) => this.adminPledge(row)) };
  }

  async createPledge(actorUserId: string, input: CreatePledgeRequest): Promise<AdminPledge> {
    await this.require(actorUserId, 'PLEDGE_MANAGE');
    const value = this.validatePledge(input, false) as PledgeCreateValues;
    return this.adminPledge(await this.repository.createPledge({ ...value, createdByUserId: actorUserId, updatedByUserId: actorUserId }, actorUserId));
  }

  async patchPledge(actorUserId: string, id: string, input: PatchPledgeRequest): Promise<AdminPledge> {
    await this.require(actorUserId, 'PLEDGE_MANAGE');
    this.uuid(id);
    const current = await this.repository.findPledge(id);
    if (!current) throw new NotFoundException('pledge_not_found');
    const value = this.validatePledge(input, true);
    const updated = await this.repository.patchPledge(id, actorUserId, { ...value, updatedByUserId: actorUserId, updatedAt: this.clock.now() }, Object.keys(value).join(',') || 'record');
    if (!updated) throw new NotFoundException('pledge_not_found');
    return this.adminPledge(updated);
  }

  private async summary(bundle: VoteBundle, locale: ContentLocale, actorUserId: string | undefined, identity: { hashes: string[] } | null, state: VoteState) {
    const stats = await this.repository.stats(bundle.vote.id);
    let participation: VoteParticipationState = 'NOT_AUTHENTICATED';
    if (actorUserId) {
      participation = identity && await this.repository.isEligible(bundle.vote.id, identity.hashes) ? 'ELIGIBLE' : 'INELIGIBLE';
      if (participation === 'ELIGIBLE' && await this.repository.hasParticipant(bundle.vote.id, actorUserId)) participation = 'VOTED';
    }
    return {
      id: bundle.vote.id,
      title: this.localized(locale, bundle.vote.titleKr, bundle.vote.titleEn),
      description: this.localized(locale, bundle.vote.descriptionKr, bundle.vote.descriptionEn),
      state,
      opensAt: bundle.vote.opensAt.toISOString(),
      closesAt: bundle.vote.closesAt.toISOString(),
      anonymous: bundle.vote.anonymous,
      validTurnoutPercent: bundle.vote.validTurnoutPercent,
      eligibleVoterCount: stats.eligibleVoterCount,
      turnoutPercent: this.turnout(stats.participantCount, stats.eligibleVoterCount),
      participation,
      resultsVisibleUntil: bundle.vote.resultsVisibleUntil?.toISOString() ?? null,
    };
  }

  private async adminVote(bundle: VoteBundle): Promise<AdminVote> {
    const stats = await this.repository.stats(bundle.vote.id);
    return {
      id: bundle.vote.id,
      titleKr: bundle.vote.titleKr,
      titleEn: bundle.vote.titleEn,
      descriptionKr: bundle.vote.descriptionKr,
      descriptionEn: bundle.vote.descriptionEn,
      state: this.effectiveState(bundle.vote, this.clock.now()),
      opensAt: bundle.vote.opensAt.toISOString(),
      closesAt: bundle.vote.closesAt.toISOString(),
      anonymous: bundle.vote.anonymous,
      validTurnoutPercent: bundle.vote.validTurnoutPercent,
      eligibleVoterCount: stats.eligibleVoterCount,
      turnoutPercent: this.turnout(stats.participantCount, stats.eligibleVoterCount),
      resultsPublishedAt: bundle.vote.resultsPublishedAt?.toISOString() ?? null,
      resultsVisibleUntil: bundle.vote.resultsVisibleUntil?.toISOString() ?? null,
      candidates: bundle.candidates.map((candidate) => ({ id: candidate.id, ordinal: candidate.ordinal, nameKr: candidate.nameKr, nameEn: candidate.nameEn, descriptionKr: candidate.descriptionKr, descriptionEn: candidate.descriptionEn, imageUrl: candidate.imageUrl })),
      createdAt: bundle.vote.createdAt.toISOString(),
      updatedAt: bundle.vote.updatedAt.toISOString(),
    };
  }

  private async resultDtos(candidates: VoteCandidateRow[], counts: Array<{ candidateId: string; voteCount: number }>, locale: ContentLocale): Promise<VoteResult[]> {
    const total = counts.reduce((sum, row) => sum + row.voteCount, 0);
    return candidates.map((candidate) => {
      const voteCount = counts.find((row) => row.candidateId === candidate.id)?.voteCount ?? 0;
      return { candidate: this.candidate(candidate, locale), voteCount, percent: total === 0 ? 0 : Math.round(voteCount / total * 1000) / 10 };
    });
  }

  private candidate(row: VoteCandidateRow, locale: ContentLocale): VoteCandidate {
    return { id: row.id, ordinal: row.ordinal, name: this.localized(locale, row.nameKr, row.nameEn), description: this.localized(locale, row.descriptionKr, row.descriptionEn), imageUrl: row.imageUrl };
  }

  private pledge(row: PledgeRow, locale: ContentLocale): Pledge {
    return { id: row.id, ordinal: row.ordinal, title: this.localized(locale, row.titleKr, row.titleEn), description: this.localized(locale, row.descriptionKr, row.descriptionEn), status: row.status, progressPercent: row.progressPercent, progress: this.localized(locale, row.progressKr, row.progressEn), targetDate: row.targetDate };
  }

  private adminPledge(row: PledgeRow): AdminPledge {
    return { id: row.id, ordinal: row.ordinal, titleKr: row.titleKr, titleEn: row.titleEn, descriptionKr: row.descriptionKr, descriptionEn: row.descriptionEn, status: row.status, progressPercent: row.progressPercent, progressKr: row.progressKr, progressEn: row.progressEn, targetDate: row.targetDate, isPublished: row.isPublished, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  private validateCreateVote(input: CreateVoteRequest) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.candidates)) throw new UnprocessableEntityException('invalid_vote');
    const titleKr = this.text(input.titleKr); const titleEn = this.text(input.titleEn);
    const descriptionKr = this.text(input.descriptionKr); const descriptionEn = this.text(input.descriptionEn);
    const opensAt = this.date(input.opensAt); const closesAt = this.date(input.closesAt);
    if (closesAt <= opensAt) throw new UnprocessableEntityException('invalid_vote_window');
    if (!Number.isSafeInteger(input.validTurnoutPercent) || input.validTurnoutPercent < 1 || input.validTurnoutPercent > 100) throw new UnprocessableEntityException('invalid_vote_turnout');
    if (input.anonymous !== undefined && typeof input.anonymous !== 'boolean') throw new UnprocessableEntityException('invalid_vote');
    if (input.candidates.length < 2 || input.candidates.length > 50) throw new UnprocessableEntityException('invalid_vote_candidates');
    const candidates = input.candidates.map((candidate) => ({ nameKr: this.text(candidate.nameKr), nameEn: this.text(candidate.nameEn), descriptionKr: this.optionalText(candidate.descriptionKr), descriptionEn: this.optionalText(candidate.descriptionEn), imageUrl: this.imageUrl(candidate.imageUrl) }));
    return { titleKr, titleEn, descriptionKr, descriptionEn, opensAt, closesAt, anonymous: input.anonymous ?? true, validTurnoutPercent: input.validTurnoutPercent, candidates };
  }

  private validatePatchVote(input: PatchVoteRequest, current: VoteRow): Partial<votesInsertShape> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) throw new UnprocessableEntityException('invalid_vote');
    const allowed = new Set(['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'opensAt', 'closesAt', 'validTurnoutPercent']);
    if (Object.keys(input).some((key) => !allowed.has(key))) throw new UnprocessableEntityException('invalid_vote');
    const opensAt = input.opensAt === undefined ? current.opensAt : this.date(input.opensAt);
    const closesAt = input.closesAt === undefined ? current.closesAt : this.date(input.closesAt);
    if (closesAt <= opensAt) throw new UnprocessableEntityException('invalid_vote_window');
    const turnout = input.validTurnoutPercent ?? current.validTurnoutPercent;
    if (!Number.isSafeInteger(turnout) || turnout < 1 || turnout > 100) throw new UnprocessableEntityException('invalid_vote_turnout');
    return {
      ...(input.titleKr === undefined ? {} : { titleKr: this.text(input.titleKr) }),
      ...(input.titleEn === undefined ? {} : { titleEn: this.text(input.titleEn) }),
      ...(input.descriptionKr === undefined ? {} : { descriptionKr: this.text(input.descriptionKr) }),
      ...(input.descriptionEn === undefined ? {} : { descriptionEn: this.text(input.descriptionEn) }),
      ...(input.opensAt === undefined ? {} : { opensAt }),
      ...(input.closesAt === undefined ? {} : { closesAt }),
      ...(input.validTurnoutPercent === undefined ? {} : { validTurnoutPercent: turnout }),
    };
  }

  private validatePledge(input: CreatePledgeRequest | PatchPledgeRequest, partial: boolean) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || (!partial && Object.keys(input).length === 0)) throw new UnprocessableEntityException('invalid_pledge');
    const allowed = new Set(['ordinal', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'status', 'progressPercent', 'progressKr', 'progressEn', 'targetDate', 'isPublished']);
    if (Object.keys(input).some((key) => !allowed.has(key))) throw new UnprocessableEntityException('invalid_pledge');
    const value: Record<string, unknown> = {};
    if (input.ordinal !== undefined) { if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 0) throw new UnprocessableEntityException('invalid_pledge'); value.ordinal = input.ordinal; }
    for (const key of ['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'progressKr', 'progressEn'] as const) if (input[key] !== undefined) value[key] = this.text(input[key]);
    if (input.status !== undefined) { if (!PLEDGE_STATUSES.includes(input.status)) throw new UnprocessableEntityException('invalid_pledge_status'); value.status = input.status; }
    if (input.progressPercent !== undefined) { if (!Number.isSafeInteger(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) throw new UnprocessableEntityException('invalid_pledge_progress'); value.progressPercent = input.progressPercent; }
    if (input.targetDate !== undefined) { value.targetDate = input.targetDate === null ? null : this.calendarDate(input.targetDate); }
    if (input.isPublished !== undefined) { if (typeof input.isPublished !== 'boolean') throw new UnprocessableEntityException('invalid_pledge'); value.isPublished = input.isPublished; }
    if (!partial && (value.ordinal === undefined || value.titleKr === undefined || value.titleEn === undefined || value.descriptionKr === undefined || value.descriptionEn === undefined || value.progressKr === undefined || value.progressEn === undefined)) throw new UnprocessableEntityException('invalid_pledge');
    return value as Partial<pledgesInsertShape>;
  }

  private effectiveState(row: VoteRow, now: Date): VoteState {
    if (row.state === 'SCHEDULED' && row.opensAt <= now && row.closesAt > now) return 'OPEN';
    if (row.state === 'SCHEDULED' && row.closesAt <= now) return 'CLOSED';
    if (row.state === 'OPEN' && row.closesAt <= now) return 'CLOSED';
    if (row.state === 'RESULTS_PUBLISHED' && row.resultsVisibleUntil && row.resultsVisibleUntil <= now) return 'RESULTS_RETIRED';
    return row.state;
  }

  private async identityHashes(userId: string): Promise<{ hashes: string[] }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('user_not_found');
    const hashes: string[] = [];
    if (user.ssoSubject) hashes.push(this.hashIdentity('SSO_SUBJECT', this.normalizeIdentity(user.ssoSubject)));
    if (user.studentOrEmployeeNumber) hashes.push(this.hashIdentity('STUDENT_NUMBER', this.normalizeIdentity(user.studentOrEmployeeNumber)));
    return { hashes: [...new Set(hashes)] };
  }

  private hashIdentity(kind: 'SSO_SUBJECT' | 'STUDENT_NUMBER', value: string): string {
    return createHash('sha256').update(`vote-voter\u0000${kind}\u0000${value}`).digest('hex');
  }

  private normalizeIdentity(value: string): string { return value.trim().replace(/\s+/g, '').toUpperCase(); }
  private turnout(participants: number, eligible: number): number { return eligible === 0 ? 0 : Math.round(participants / eligible * 1000) / 10; }
  private localized(locale: ContentLocale, kr: string, en: string): LocalizedContent { const value = locale === 'ko' ? kr : en; return { value: value || null, translationUnavailable: !value }; }
  private locale(value: unknown): ContentLocale { if (value === undefined || value === 'ko') return 'ko'; if (value === 'en') return 'en'; throw new UnprocessableEntityException('invalid_locale'); }
  private text(value: unknown): string { if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) throw new UnprocessableEntityException('invalid_governance_text'); return value.trim(); }
  private optionalText(value: unknown): string { if (value === undefined || value === null) return ''; return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : (() => { throw new UnprocessableEntityException('invalid_governance_text'); })(); }
  private imageUrl(value: unknown): string | null { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string' || value.length > 2_000 || !(/^(https?:\/\/|\/)/i.test(value))) throw new UnprocessableEntityException('invalid_vote_image'); return value; }
  private date(value: unknown): Date { if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new UnprocessableEntityException('invalid_governance_date'); const result = new Date(value); if (!Number.isFinite(result.getTime())) throw new UnprocessableEntityException('invalid_governance_date'); return result; }
  private calendarDate(value: string): string { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new UnprocessableEntityException('invalid_pledge_date'); return value; }
  private uuid(value: string): void { if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_governance_id'); }
  private async require(userId: string, permission: 'VOTE_MANAGE' | 'PLEDGE_MANAGE'): Promise<void> { if (!(await this.permissions.hasPermission(userId, permission, 'GLOBAL'))) throw new ForbiddenException('insufficient_permission'); }
}

// These structural aliases keep the validation return types independent of Drizzle's generated insert helper.
type votesInsertShape = {
  titleKr?: string; titleEn?: string; descriptionKr?: string; descriptionEn?: string;
  opensAt?: Date; closesAt?: Date; validTurnoutPercent?: number;
};
type pledgesInsertShape = {
  ordinal?: number; titleKr?: string; titleEn?: string; descriptionKr?: string; descriptionEn?: string;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'; progressPercent?: number; progressKr?: string; progressEn?: string;
  targetDate?: string | null; isPublished?: boolean;
};
type PledgeCreateValues = {
  ordinal: number;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  progressKr: string;
  progressEn: string;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  progressPercent?: number;
  targetDate?: string | null;
  isPublished?: boolean;
};
