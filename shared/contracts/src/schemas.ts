/**
 * ── Zod Request Schemas ──────────────────────────────────────────────────────
 *
 * 모든 HTTP request body에 대한 Zod 스키마입니다.
 * NestJS의 ZodValidationPipe와 함께 사용하여 런타임 입력 검증을 수행합니다.
 *
 * contract 타입(interfaces)과 1:1 대응되며, z.infer로 타입을 추출할 수 있습니다.
 */

import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const ConsentDecisionSchema = z.object({
  consent: z.boolean(),
  pendingLoginToken: z.string().min(1),
});

export const SsoCallbackBodySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  state: z.string().optional(),
});

// ─── Board / Article ─────────────────────────────────────────────────────────

const VisibilityScopeSchema = z.enum(["PUBLIC", "MEMBERS", "STAFF_ONLY"]);

const ArticleAssetRequestSchema = z.object({
  assetId: z.string().min(1),
  usageType: z.enum(["IMAGE", "ATTACHMENT", "THUMBNAIL"]),
  sortOrder: z.number().int().min(0),
});

export const ArticleCreateSchema = z.object({
  titleKo: z.string().min(1).max(255),
  titleEn: z.string().max(255).optional(),
  contentKo: z.string().min(1).max(50_000),
  contentEn: z.string().max(50_000).optional(),
  visibilityScope: VisibilityScopeSchema,
  isPinned: z.boolean().optional(),
  pinOrder: z.number().int().nullable().optional(),
  isAnonymous: z.boolean().optional(),
  assets: z.array(ArticleAssetRequestSchema).optional(),
});

export const ArticleUpdateSchema = z.object({
  titleKo: z.string().min(1).max(255).optional(),
  titleEn: z.string().max(255).optional(),
  contentKo: z.string().min(1).max(50_000).optional(),
  contentEn: z.string().max(50_000).optional(),
  visibilityScope: VisibilityScopeSchema.optional(),
  isPinned: z.boolean().optional(),
  pinOrder: z.number().int().nullable().optional(),
  isAnonymous: z.boolean().optional(),
  assets: z.array(ArticleAssetRequestSchema).optional(),
});

// ─── Comment ─────────────────────────────────────────────────────────────────

export const CommentCreateSchema = z.object({
  parentCommentId: z.string().nullable().optional(),
  content: z.string().min(1).max(50_000),
});

export const CommentUpdateSchema = z.object({
  content: z.string().min(1).max(50_000),
});

// ─── Survey ──────────────────────────────────────────────────────────────────

export const CreateSurveySchema = z.object({
  kind: z.string().min(1).max(20),
  titleKo: z.string().min(1).max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  status: z.string().max(20).optional(),
  feeRequirementPolicy: z.string().max(20).optional(),
  allowGuestResponse: z.boolean().optional(),
  resultVisibility: z.string().min(1).max(20),
  maxResponseCount: z.number().int().positive().nullable().optional(),
  openAt: z.string().optional(),
  closeAt: z.string().optional(),
  connectedArticleId: z.string().optional(),
});

export const UpdateSurveySchema = CreateSurveySchema.partial();

export const CreateSectionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

export const CreateQuestionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  questionType: z.string().min(1),
  options: z.any().optional(),
  answerRegex: z.string().optional(),
  isRequired: z.boolean().optional(),
  editDeadlineAt: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateQuestionSchema = CreateQuestionSchema.partial();

export const SubmitResponseSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      content: z.record(z.string(), z.unknown()),
    }),
  ),
  externalPhone: z.string().optional(),
});

export const ReviewResponseSchema = z.object({
  status: z.enum(["approved", "rejected", "waitlisted"]),
  reviewReason: z.string().optional(),
});

// ─── Role Groups ─────────────────────────────────────────────────────────────

export const CreateRoleGroupSchema = z.object({
  code: z.string().min(1).max(50),
  nameKo: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.number().int().positive()),
});

export const UpdateRoleGroupSchema = CreateRoleGroupSchema;

export const AssignRoleGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});

// ─── Finance ─────────────────────────────────────────────────────────────────

export const UpdateStudentFeeStatusSchema = z.object({
  status: z.enum(["PAID", "UNPAID"]),
  coverageSemesters: z.number().int().positive().optional(),
  note: z.string().nullable().optional(),
});
