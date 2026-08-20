/**
 * ── Zod Request Schemas ──────────────────────────────────────────────────────
 *
 * 모든 HTTP request body에 대한 Zod 스키마입니다.
 * NestJS의 ZodValidationPipe와 함께 사용하여 런타임 입력 검증을 수행합니다.
 *
 * contract 타입(interfaces)과 1:1 대응되며, z.infer로 타입을 추출할 수 있습니다.
 */

import { z } from "zod";

// ─── Site Content ────────────────────────────────────────────────────────────

/**
 * Public-site copy that may be edited through the CMS.
 *
 * Keys are deliberately finite: each key has an explicit UI consumer and can
 * be reviewed independently. Add a key here (and a matching DB enum migration)
 * when a new editable public section is introduced.
 */
export const SITE_CONTENT_KEYS = [
  "home.hero.title",
  "home.hero.description",
  "home.hero.cta",
  "about.hero.description",
  "about.intro.title",
  "about.intro.body",
  "about.roadmap.title",
  "about.roadmap.description",
  "footer.description",
  "footer.contact",
] as const;

export const SiteContentKeySchema = z.enum(SITE_CONTENT_KEYS);

const SiteContentValueSchema = z.string().trim().min(1).max(20_000);

export const UpsertSiteContentSchema = z
  .object({
    valueKo: SiteContentValueSchema,
    valueEn: SiteContentValueSchema,
  })
  .strict();

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

export const VisibilityScopeSchema = z.enum(["PUBLIC", "MEMBERS", "STAFF_ONLY"]);

export const ArticleAssetRequestSchema = z.object({
  assetId: z.string().regex(/^\d+$/),
  usageType: z.enum(["IMAGE", "ATTACHMENT", "THUMBNAIL"]),
  sortOrder: z.number().int().min(0),
});

const ArticleAssetsSchema = z
  .array(ArticleAssetRequestSchema)
  .superRefine((items, context) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.assetId)) {
        context.addIssue({
          code: "custom",
          message: "duplicate_asset_id",
          path: [items.indexOf(item), "assetId"],
        });
      }
      seen.add(item.assetId);
    }
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
  allowComment: z.boolean().optional(),
  assets: ArticleAssetsSchema.optional(),
  eventStartDate: z.string().nullable().optional(),
  eventEndDate: z.string().nullable().optional(),
  eventDescriptionKo: z.string().nullable().optional(),
  eventDescriptionEn: z.string().nullable().optional(),
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
  allowComment: z.boolean().optional(),
  assets: ArticleAssetsSchema.optional(),
  eventStartDate: z.string().nullable().optional(),
  eventEndDate: z.string().nullable().optional(),
  eventDescriptionKo: z.string().nullable().optional(),
  eventDescriptionEn: z.string().nullable().optional(),
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

const SurveyResultVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const CreateSurveySchema = z.object({
  kind: z.string().min(1).max(20),
  titleKo: z.string().min(1).max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  feeRequirementPolicy: z.string().max(20).optional(),
  allowMultipleResponses: z.boolean().optional(),
  allowResponseEdit: z.boolean().optional(),
  isKoreanOnly: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  showOnCalendar: z.boolean().optional(),
  isAlwaysOpen: z.boolean().optional(),
  resultVisibility: SurveyResultVisibilitySchema.default("PRIVATE"),
  maxResponseCount: z.number().int().positive().nullable().optional(),
  openAt: z.string().nullable().optional(),
  closeAt: z.string().nullable().optional(),
  connectedArticleId: z.string().nullable().optional(),
});

export const UpdateSurveySchema = CreateSurveySchema.partial().extend({
  // Do not apply the create-only default to PATCH requests.
  resultVisibility: SurveyResultVisibilitySchema.optional(),
});

export const CreateSectionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

export const QuestionTypeSchema = z.enum([
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "date",
  "time",
  "datetime",
]);

export const QuestionOptionSchema = z.object({
  value: z.string().min(1),
  labelKo: z.string().min(1),
  labelEn: z.string().optional(),
});

export const CreateQuestionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  questionType: QuestionTypeSchema,
  options: z.array(QuestionOptionSchema).optional(),
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
});

// ─── Role Groups ─────────────────────────────────────────────────────────────

export const CreateRoleGroupSchema = z.object({
  nameKo: z.string().min(1).max(100),
  description: z.string().optional(),
  permissionIds: z.array(z.number().int().positive()),
});

export const UpdateRoleGroupSchema = CreateRoleGroupSchema;

export const AssignRoleGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});

// ─── Finance ─────────────────────────────────────────────────────────────────

export const UpdateStudentFeeStatusSchema = z
  .object({
    paidAmount: z.number().int().min(0).max(100_000_000).optional(),
    status: z.enum(["PAID", "UNPAID"]).optional(),
    coverageSemesters: z.number().int().positive().optional(),
    note: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.paidAmount !== undefined ||
      value.status !== undefined ||
      value.coverageSemesters !== undefined ||
      value.note !== undefined,
    { message: "fee_status_update_required" },
  );

// ─── Executive Contacts ──────────────────────────────────────────────────────

const RequiredContactTextSchema = z.string().trim().min(1).max(100);

export const CreateContactSchema = z.object({
  nameKo: RequiredContactTextSchema,
  nameEn: RequiredContactTextSchema,
  roleKo: RequiredContactTextSchema,
  roleEn: RequiredContactTextSchema,
  email: z.string().email().or(z.literal("")).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// PATCH keeps the same validation and normalization rules as creation, but
// only applies them to fields the caller actually supplies.
export const UpdateContactSchema = CreateContactSchema.partial();

export const BulkImportContactsSchema = z.object({
  items: z.array(CreateContactSchema).min(1).max(500),
  replaceExisting: z.boolean().default(false),
});

// ─── Bulk Email ──────────────────────────────────────────────────────────────

export const SendBulkEmailSchema = z.object({
  subject: z.string().min(1).max(255),
  content: z.string().min(1),
  recipientType: z.enum(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"]),
});
