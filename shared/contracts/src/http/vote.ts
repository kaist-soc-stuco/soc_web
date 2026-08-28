import { z } from "zod";

export const VoteItemTypeSchema = z.enum([
  "YES_NO_ABSTAIN",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
]);
export const VoteStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "TALLIED"]);

const VoteOptionInputSchema = z.object({
  id: z.string().uuid().optional(),
  labelKo: z.string().trim().min(1).max(255),
  labelEn: z.string().trim().max(255).nullable().optional(),
  descriptionKo: z.string().trim().max(2_000).nullable().optional(),
  descriptionEn: z.string().trim().max(2_000).nullable().optional(),
  imageUrl: z.string().trim().max(2_000).nullable().optional(),
}).strict();

export const VoteItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  titleKo: z.string().trim().min(1).max(500),
  titleEn: z.string().trim().max(500).nullable().optional(),
  descriptionKo: z.string().trim().max(5_000).nullable().optional(),
  descriptionEn: z.string().trim().max(5_000).nullable().optional(),
  type: VoteItemTypeSchema,
  maxSelections: z.number().int().min(1).max(100).default(1),
  options: z.array(VoteOptionInputSchema).min(2).max(100),
}).strict().superRefine((item, context) => {
  if (item.type === "YES_NO_ABSTAIN" && item.options.length !== 3) {
    context.addIssue({ code: "custom", message: "vote_yes_no_requires_three_options", path: ["options"] });
  }
  if (item.type !== "MULTIPLE_CHOICE" && item.maxSelections !== 1) {
    context.addIssue({ code: "custom", message: "vote_single_choice_max_selection_invalid", path: ["maxSelections"] });
  }
  if (item.maxSelections > item.options.length) {
    context.addIssue({ code: "custom", message: "vote_max_selection_exceeds_options", path: ["maxSelections"] });
  }
});

const VoteDefinitionFields = z.object({
  titleKo: z.string().trim().min(1).max(255),
  titleEn: z.string().trim().max(255).nullable().optional(),
  descriptionKo: z.string().trim().max(20_000).nullable().optional(),
  descriptionEn: z.string().trim().max(20_000).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  academicStatuses: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  feePayersOnly: z.boolean().default(false),
  studentNumberFrom: z.string().trim().max(20).nullable().optional(),
  studentNumberTo: z.string().trim().max(20).nullable().optional(),
  items: z.array(VoteItemInputSchema).min(1).max(30),
});

const validateSchedule = (
  value: { startsAt?: string; endsAt?: string },
  context: z.RefinementCtx,
) => {
  if (value.startsAt && value.endsAt && Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
    context.addIssue({ code: "custom", message: "vote_invalid_schedule", path: ["endsAt"] });
  }
};

export const CreateVoteSchema = VoteDefinitionFields.strict().superRefine(validateSchedule);
export const UpdateVoteSchema = VoteDefinitionFields.partial().strict().superRefine(validateSchedule);

export const SubmitVoteBallotSchema = z.object({
  answers: z.array(z.object({
    itemId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).min(1).max(100),
  }).strict()).min(1).max(30),
}).strict();

export const VoteVoterMutationSchema = z.object({
  userIds: z.array(z.string().uuid()).max(2_000).default([]),
  studentNumbers: z.array(z.string().trim().min(1).max(20)).max(2_000).default([]),
}).strict().refine((value) => value.userIds.length > 0 || value.studentNumbers.length > 0, {
  message: "vote_voter_identifier_required",
});

export type VoteItemType = z.infer<typeof VoteItemTypeSchema>;
export type VoteStatus = z.infer<typeof VoteStatusSchema>;
export type CreateVoteRequest = z.infer<typeof CreateVoteSchema>;
export type UpdateVoteRequest = z.infer<typeof UpdateVoteSchema>;
export type SubmitVoteBallotRequest = z.infer<typeof SubmitVoteBallotSchema>;
export type VoteVoterMutationRequest = z.infer<typeof VoteVoterMutationSchema>;

export interface VoteOptionRecord {
  id: string;
  labelKo: string;
  labelEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface VoteItemRecord {
  id: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  type: VoteItemType;
  maxSelections: number;
  sortOrder: number;
  options: VoteOptionRecord[];
}

export interface VoteRecord {
  id: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  status: VoteStatus;
  startsAt: string;
  endsAt: string;
  academicStatuses: string[];
  feePayersOnly: boolean;
  studentNumberFrom: string | null;
  studentNumberTo: string | null;
  voterSnapshotAt: string | null;
  resultsPublishedAt: string | null;
  eligibleCount: number;
  votedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoteDetailResponse extends VoteRecord {
  items: VoteItemRecord[];
  eligibility: "LOGIN_REQUIRED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "ALREADY_VOTED";
  isManager: boolean;
}

export interface VoteVoterRecord {
  userId: string;
  nameKo: string;
  studentNumber: string | null;
  email: string;
  primaryMajor: string | null;
  academicStatus: string | null;
  feeStatus: string | null;
  status: "ELIGIBLE" | "EXCLUDED";
  source: "FILTER" | "MANUAL" | "IMPORT";
  hasVoted: boolean;
  votedAt: string | null;
}

export interface VoteResultOption {
  optionId: string;
  labelKo: string;
  labelEn: string | null;
  count: number;
  percentage: number;
}

export interface VoteResultItem {
  itemId: string;
  titleKo: string;
  titleEn: string | null;
  options: VoteResultOption[];
}

export interface VoteResultsResponse {
  voteId: string;
  totalBallots: number;
  talliedAt: string;
  publishedAt: string | null;
  items: VoteResultItem[];
}

export interface VoteSubmissionResponse {
  receiptCode: string;
  submittedAt: string;
}
