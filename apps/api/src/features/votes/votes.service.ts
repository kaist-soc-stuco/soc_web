import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Permissions,
  type CreateVoteRequest,
  type SubmitVoteBallotRequest,
  type UpdateVoteRequest,
  type VoteDetailResponse,
  type VoteItemRecord,
  type VoteRecord,
  type VoteResultsResponse,
} from "@soc/contracts";
import { isoToDate, nowIso, nowMs } from "@soc/shared";

import { VoteCryptoService } from "./vote-crypto.service";
import { VotesRepository } from "./votes.repository";

interface Caller { id: string; permission: number }

@Injectable()
export class VotesService {
  constructor(
    private readonly repo: VotesRepository,
    private readonly crypto: VoteCryptoService,
  ) {}

  private isManager(caller?: Caller): boolean {
    return Boolean(caller && Permissions.has(caller.permission, Permissions.MANAGE_VOTE));
  }

  private mapVote(row: Awaited<ReturnType<VotesRepository["findVote"]>> & {}, counts: { eligibleCount: number; votedCount: number }): VoteRecord {
    return {
      id: row.voteId,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      status: row.status as VoteRecord["status"],
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      academicStatuses: row.academicStatuses,
      feePayersOnly: row.feePayersOnly,
      studentNumberFrom: row.studentNumberFrom,
      studentNumberTo: row.studentNumberTo,
      voterSnapshotAt: row.voterSnapshotAt?.toISOString() ?? null,
      resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
      eligibleCount: counts.eligibleCount,
      votedCount: counts.votedCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapItems(rows: Awaited<ReturnType<VotesRepository["findDefinition"]>>): VoteItemRecord[] {
    return rows.map((item) => ({
      id: item.itemId,
      titleKo: item.titleKo,
      titleEn: item.titleEn,
      descriptionKo: item.descriptionKo,
      descriptionEn: item.descriptionEn,
      type: item.type as VoteItemRecord["type"],
      maxSelections: item.maxSelections,
      sortOrder: item.sortOrder,
      options: item.options.map((option) => ({
        id: option.optionId,
        labelKo: option.labelKo,
        labelEn: option.labelEn,
        descriptionKo: option.descriptionKo,
        descriptionEn: option.descriptionEn,
        imageUrl: option.imageUrl,
        sortOrder: option.sortOrder,
      })),
    }));
  }

  async listAll(): Promise<VoteRecord[]> {
    const rows = await this.repo.list(false);
    return rows.map(({ vote, eligibleCount, votedCount }) => this.mapVote(vote, { eligibleCount, votedCount }));
  }

  async listPublic(): Promise<VoteRecord[]> {
    const rows = await this.repo.list(true);
    return rows.map(({ vote, eligibleCount, votedCount }) => this.mapVote(vote, { eligibleCount, votedCount }));
  }

  async listVoters(id: string) {
    const vote = await this.repo.findVote(id);
    if (!vote) throw new NotFoundException("vote_not_found");
    return this.repo.listVoters(id);
  }

  async detail(id: string, caller?: Caller): Promise<VoteDetailResponse> {
    const vote = await this.repo.findVote(id);
    if (!vote || (vote.status === "DRAFT" && !this.isManager(caller))) {
      throw new NotFoundException("vote_not_found");
    }
    const [items, counts] = await Promise.all([this.repo.findDefinition(id), this.repo.counts(id)]);
    let eligibility: VoteDetailResponse["eligibility"] = "LOGIN_REQUIRED";
    if (caller) {
      const voter = await this.repo.findVoter(id, caller.id);
      eligibility = !voter || voter.status !== "ELIGIBLE"
        ? "NOT_ELIGIBLE"
        : voter.hasVoted
          ? "ALREADY_VOTED"
          : "ELIGIBLE";
    }
    return {
      ...this.mapVote(vote, counts),
      items: this.mapItems(items),
      eligibility,
      isManager: this.isManager(caller),
    };
  }

  async create(creatorId: string, input: CreateVoteRequest): Promise<VoteDetailResponse> {
    const vote = await this.repo.create(creatorId, input);
    return this.detail(vote.voteId, { id: creatorId, permission: Permissions.MANAGE_VOTE });
  }

  async update(id: string, input: UpdateVoteRequest): Promise<VoteDetailResponse> {
    const current = await this.repo.findVote(id);
    if (!current) throw new NotFoundException("vote_not_found");
    if (current.status !== "DRAFT") throw new ConflictException("published_vote_definition_locked");
    const startsAt = input.startsAt ? isoToDate(input.startsAt) : current.startsAt;
    const endsAt = input.endsAt ? isoToDate(input.endsAt) : current.endsAt;
    if (startsAt >= endsAt) throw new BadRequestException("vote_invalid_schedule");
    const updated = await this.repo.updateDraft(id, input);
    if (!updated) throw new ConflictException("vote_state_changed");
    return this.detail(id, { id: current.creatorId ?? "", permission: Permissions.MANAGE_VOTE });
  }

  async delete(id: string): Promise<void> {
    if (!await this.repo.deleteDraft(id)) throw new ConflictException("only_draft_vote_can_be_deleted");
  }

  async publish(id: string): Promise<VoteDetailResponse> {
    const vote = await this.repo.findVote(id);
    if (!vote) throw new NotFoundException("vote_not_found");
    if (vote.status !== "DRAFT") throw new ConflictException("vote_already_published");
    const definition = await this.repo.findDefinition(id);
    if (definition.length === 0 || definition.some((item) => item.options.length < 2)) {
      throw new BadRequestException("vote_definition_incomplete");
    }
    const key = this.crypto.generateVoteKey();
    const wrapped = this.crypto.wrapVoteKey(key);
    const result = await this.repo.snapshotPrimaryMajorVoters(vote, wrapped);
    if (!result.published) throw new ConflictException("vote_state_changed");
    return this.detail(id, { id: vote.creatorId ?? "", permission: Permissions.MANAGE_VOTE });
  }

  async close(id: string): Promise<VoteDetailResponse> {
    const vote = await this.repo.close(id);
    if (!vote) throw new ConflictException("vote_cannot_be_closed");
    return this.detail(id, { id: vote.creatorId ?? "", permission: Permissions.MANAGE_VOTE });
  }

  async addVoters(id: string, input: { userIds: string[]; studentNumbers: string[] }) {
    const vote = await this.repo.findVote(id);
    if (!vote) throw new NotFoundException("vote_not_found");
    if (vote.status !== "PUBLISHED" || nowMs() >= vote.endsAt.valueOf()) {
      throw new ConflictException("vote_voter_roll_locked");
    }
    return { added: await this.repo.addVoters(id, input.userIds, input.studentNumbers) };
  }

  async excludeVoters(id: string, input: { userIds: string[] }) {
    const vote = await this.repo.findVote(id);
    if (!vote) throw new NotFoundException("vote_not_found");
    if (vote.status !== "PUBLISHED" || nowMs() >= vote.endsAt.valueOf()) {
      throw new ConflictException("vote_voter_roll_locked");
    }
    return { excluded: await this.repo.excludeVoters(id, input.userIds) };
  }

  private unwrapKey(vote: NonNullable<Awaited<ReturnType<VotesRepository["findVote"]>>>) {
    if (!vote.encryptedBallotKey || !vote.keyIv || !vote.keyTag) {
      throw new ConflictException("vote_encryption_key_missing");
    }
    return this.crypto.unwrapVoteKey({ ciphertext: vote.encryptedBallotKey, iv: vote.keyIv, authTag: vote.keyTag });
  }

  async submit(id: string, userId: string, input: SubmitVoteBallotRequest) {
    const vote = await this.repo.findVote(id);
    if (!vote || vote.status === "DRAFT") throw new NotFoundException("vote_not_found");
    const now = nowMs();
    if (vote.status !== "PUBLISHED" || now < vote.startsAt.valueOf() || now >= vote.endsAt.valueOf()) {
      throw new ConflictException("vote_not_open");
    }
    const voter = await this.repo.findVoter(id, userId);
    if (!voter || voter.status !== "ELIGIBLE") throw new ForbiddenException("vote_not_eligible");
    if (voter.hasVoted) throw new ConflictException("vote_already_submitted");
    const definition = this.mapItems(await this.repo.findDefinition(id));
    if (input.answers.length !== definition.length) throw new BadRequestException("vote_all_items_required");
    const answerMap = new Map(input.answers.map((answer) => [answer.itemId, answer.optionIds]));
    for (const item of definition) {
      const optionIds = answerMap.get(item.id);
      if (!optionIds || optionIds.length === 0) throw new BadRequestException("vote_all_items_required");
      if (new Set(optionIds).size !== optionIds.length) throw new BadRequestException("vote_duplicate_option");
      if (optionIds.length > item.maxSelections) throw new BadRequestException("vote_too_many_selections");
      const allowed = new Set(item.options.map((option) => option.id));
      if (optionIds.some((optionId) => !allowed.has(optionId))) throw new BadRequestException("vote_option_invalid");
    }
    const receipt = this.crypto.createReceipt();
    const encrypted = this.crypto.encryptBallot({ answers: input.answers }, this.unwrapKey(vote));
    const accepted = await this.repo.submitBallot({
      voteId: id, userId, ciphertext: encrypted.ciphertext, iv: encrypted.iv,
      authTag: encrypted.authTag, receiptHash: receipt.hash,
    });
    if (!accepted) throw new ConflictException("vote_already_submitted");
    return { receiptCode: receipt.code, submittedAt: nowIso() };
  }

  async tally(id: string): Promise<VoteResultsResponse> {
    const vote = await this.repo.findVote(id);
    if (!vote) throw new NotFoundException("vote_not_found");
    if (vote.status !== "CLOSED" && vote.status !== "TALLIED") throw new ConflictException("vote_must_be_closed_before_tally");
    if (vote.status === "TALLIED") return this.results(id, { id: "", permission: Permissions.MANAGE_VOTE });
    const definition = this.mapItems(await this.repo.findDefinition(id));
    const counts = new Map<string, number>();
    for (const item of definition) for (const option of item.options) counts.set(option.id, 0);
    const key = this.unwrapKey(vote);
    const ballots = await this.repo.listBallots(id);
    for (const ballot of ballots) {
      const decoded = this.crypto.decryptBallot({ ciphertext: ballot.ciphertext, iv: ballot.iv, authTag: ballot.authTag }, key) as SubmitVoteBallotRequest;
      for (const answer of decoded.answers) for (const optionId of answer.optionIds) {
        if (counts.has(optionId)) counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
      }
    }
    const items = definition.map((item) => ({
      itemId: item.id,
      titleKo: item.titleKo,
      titleEn: item.titleEn,
      options: item.options.map((option) => {
        const count = counts.get(option.id) ?? 0;
        return { optionId: option.id, labelKo: option.labelKo, labelEn: option.labelEn, count, percentage: ballots.length ? Math.round((count / ballots.length) * 10_000) / 100 : 0 };
      }),
    }));
    const tally = await this.repo.saveTally(id, { items }, ballots.length);
    return { voteId: id, totalBallots: ballots.length, talliedAt: tally.talliedAt.toISOString(), publishedAt: null, items };
  }

  async verifyReceipt(id: string, code: string): Promise<{ accepted: boolean }> {
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(code)) return { accepted: false };
    return { accepted: await this.repo.hasReceipt(id, this.crypto.hashReceipt(code)) };
  }

  async publishResults(id: string): Promise<VoteResultsResponse> {
    if (!await this.repo.findTally(id)) throw new ConflictException("vote_not_tallied");
    if (!await this.repo.publishResults(id)) throw new ConflictException("vote_result_cannot_be_published");
    return this.results(id, { id: "", permission: Permissions.MANAGE_VOTE });
  }

  async results(id: string, caller?: Caller): Promise<VoteResultsResponse> {
    const [vote, tally] = await Promise.all([this.repo.findVote(id), this.repo.findTally(id)]);
    if (!vote || !tally) throw new NotFoundException("vote_results_not_found");
    if (!vote.resultsPublishedAt && !this.isManager(caller)) throw new NotFoundException("vote_results_not_found");
    const result = tally.result as { items: VoteResultsResponse["items"] };
    return {
      voteId: id,
      totalBallots: tally.totalBallots,
      talliedAt: tally.talliedAt.toISOString(),
      publishedAt: vote.resultsPublishedAt?.toISOString() ?? null,
      items: result.items,
    };
  }
}
