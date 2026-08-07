import type { ContentLocale, LocalizedContent } from "./faq";

export type VoteState = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "DISCARDED" | "RESULTS_PUBLISHED" | "RESULTS_RETIRED";
export type VoteVoterIdentityKind = "SSO_SUBJECT" | "STUDENT_NUMBER";
export type VoteParticipationState = "NOT_AUTHENTICATED" | "INELIGIBLE" | "ELIGIBLE" | "VOTED";
export type PledgeStatus = "PLANNED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface VoteCandidate {
  id: string;
  ordinal: number;
  name: LocalizedContent;
  description: LocalizedContent;
  imageUrl: string | null;
}

export interface VoteResult {
  candidate: VoteCandidate;
  voteCount: number;
  percent: number;
}

export interface VoteSummary {
  id: string;
  title: LocalizedContent;
  description: LocalizedContent;
  state: VoteState;
  opensAt: string;
  closesAt: string;
  anonymous: boolean;
  validTurnoutPercent: number;
  eligibleVoterCount: number;
  turnoutPercent: number;
  participation: VoteParticipationState;
  resultsVisibleUntil: string | null;
}

export interface VoteDetail extends VoteSummary {
  candidates: VoteCandidate[];
  results: VoteResult[] | null;
}

export interface VoteListResponse {
  locale: ContentLocale;
  items: VoteSummary[];
}

export interface CastVoteRequest {
  candidateId: string;
}

export interface CastVoteResponse {
  voted: true;
  turnoutPercent: number;
}

export interface AdminVoteCandidate {
  id: string;
  ordinal: number;
  nameKr: string;
  nameEn: string;
  descriptionKr: string;
  descriptionEn: string;
  imageUrl: string | null;
}

export interface AdminVote {
  id: string;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  state: VoteState;
  opensAt: string;
  closesAt: string;
  anonymous: boolean;
  validTurnoutPercent: number;
  eligibleVoterCount: number;
  turnoutPercent: number;
  resultsPublishedAt: string | null;
  resultsVisibleUntil: string | null;
  candidates: AdminVoteCandidate[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminVoteListResponse {
  items: AdminVote[];
}

export interface CreateVoteCandidateRequest {
  nameKr: string;
  nameEn: string;
  descriptionKr?: string;
  descriptionEn?: string;
  imageUrl?: string | null;
}

export interface CreateVoteRequest {
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  opensAt: string;
  closesAt: string;
  anonymous?: boolean;
  validTurnoutPercent: number;
  candidates: CreateVoteCandidateRequest[];
}

export interface PatchVoteRequest {
  titleKr?: string;
  titleEn?: string;
  descriptionKr?: string;
  descriptionEn?: string;
  opensAt?: string;
  closesAt?: string;
  validTurnoutPercent?: number;
}

export interface ImportVoteVoterRollEntry {
  identityKind: VoteVoterIdentityKind;
  value: string;
}

export interface ImportVoteVoterRollRequest {
  entries: ImportVoteVoterRollEntry[];
}

export interface Pledge {
  id: string;
  ordinal: number;
  title: LocalizedContent;
  description: LocalizedContent;
  status: PledgeStatus;
  progressPercent: number;
  progress: LocalizedContent;
  targetDate: string | null;
}

export interface PledgeListResponse {
  locale: ContentLocale;
  items: Pledge[];
}

export interface AdminPledge {
  id: string;
  ordinal: number;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  status: PledgeStatus;
  progressPercent: number;
  progressKr: string;
  progressEn: string;
  targetDate: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPledgeListResponse {
  items: AdminPledge[];
}

export interface CreatePledgeRequest {
  ordinal: number;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  status?: PledgeStatus;
  progressPercent?: number;
  progressKr: string;
  progressEn: string;
  targetDate?: string | null;
  isPublished?: boolean;
}

export type PatchPledgeRequest = Partial<CreatePledgeRequest>;
