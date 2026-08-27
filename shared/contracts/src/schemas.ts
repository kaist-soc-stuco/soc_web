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

export const CONTENT_BLOCK_TYPES = [
  "HERO",
  "LOGO",
  "TOP_BANNER",
  "QUICK_LINK",
  "ORGANIZATION_CHART",
  "PLEDGE",
] as const;

export const PLEDGE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED"] as const;
export const PledgeStatusSchema = z.enum(PLEDGE_STATUSES);

export const CONTENT_BLOCK_STATUSES = [
  "DRAFT",
  "PUBLISHED",
] as const;

export const ContentBlockTypeSchema = z.enum(CONTENT_BLOCK_TYPES);
export const ContentBlockStatusSchema = z.enum(CONTENT_BLOCK_STATUSES);

const NullableContentBlockUrlSchema = z.string().trim().url().max(2_000).nullable();
const NullableContentBlockImageSchema = z.string().trim().max(2_000).refine(
  (value) => /^asset:\d+$/.test(value) || z.string().url().safeParse(value).success,
  "content_block_image_invalid",
).nullable();

const ContentBlockFieldsSchema = z
  .object({
    type: ContentBlockTypeSchema,
    titleKo: z.string().trim().min(1).max(255),
    titleEn: z.string().trim().max(255).default(""),
    bodyKo: z.string().trim().max(20_000).nullable().default(null),
    bodyEn: z.string().trim().max(20_000).nullable().default(null),
    linkUrl: NullableContentBlockUrlSchema.default(null),
    imageUrl: NullableContentBlockImageSchema.default(null),
    imageUrlEn: NullableContentBlockImageSchema.default(null),
    pledgeStatus: PledgeStatusSchema.nullable().default(null),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

const validateContentBlock = (
  value: { type?: string; imageUrl?: string | null; pledgeStatus?: string | null },
  context: z.RefinementCtx,
) => {
  if (
    (value.type === "HERO" ||
      value.type === "LOGO" ||
      value.type === "ORGANIZATION_CHART") &&
    value.imageUrl === null
  ) {
    context.addIssue({ code: "custom", message: "content_block_image_required", path: ["imageUrl"] });
  }
  if (value.type === "PLEDGE" && !value.pledgeStatus) {
    context.addIssue({ code: "custom", message: "pledge_status_required", path: ["pledgeStatus"] });
  }
};

export const CreateContentBlockSchema = ContentBlockFieldsSchema.superRefine(validateContentBlock);
export const UpdateContentBlockSchema = ContentBlockFieldsSchema.partial().superRefine(validateContentBlock);
export const ReorderContentBlocksSchema = z.object({
  items: z.array(z.object({
    contentBlockId: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.contentBlockId)).size !== value.items.length) {
    context.addIssue({ code: "custom", message: "content_block_duplicate_id", path: ["items"] });
  }
});

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

  const BoardPermissionBitSchema = z.number().int().nonnegative();

  export const BoardCreateSchema = z.object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^[\\p{L}\\p{N}_-]+$/u, "invalid_board_code"),
    nameKo: z.string().trim().min(1).max(20),
    nameEn: z.string().trim().max(100).optional(),
    descriptionKo: z.string().trim().max(255).optional(),
    descriptionEn: z.string().trim().max(255).optional(),
    writePermissionBit: BoardPermissionBitSchema.default(0),
    allowComment: z.boolean().default(true),
    allowSecret: z.boolean().default(false),
    allowLike: z.boolean().default(true),
    allowGuestRead: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  });

  export const BoardUpdateSchema = BoardCreateSchema.omit({ code: true }).partial().extend({
    isActive: z.boolean().optional(),
  });

  export const BoardReorderSchema = z.object({
    items: z.array(z.object({
      code: z.string().trim().min(1).max(20),
      sortOrder: z.number().int().min(0),
    })).min(1).max(100),
  }).strict();

  const CalendarDateTimeSchema = z.string().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "invalid_calendar_datetime",
  );

  const CalendarEventFieldsSchema = z.object({
    titleKo: z.string().trim().min(1).max(255),
    titleEn: z.string().trim().max(255).optional(),
    descriptionKo: z.string().max(10_000).optional(),
    descriptionEn: z.string().max(10_000).optional(),
    startAt: CalendarDateTimeSchema,
    endAt: CalendarDateTimeSchema,
    location: z.string().trim().max(255).optional(),
    sourceUid: z.string().trim().max(255).optional(),
  });

  export const CalendarEventCreateSchema = CalendarEventFieldsSchema.refine(
    (value) => Date.parse(value.endAt) >= Date.parse(value.startAt),
    {
    message: "calendar_end_before_start",
    path: ["endAt"],
    },
  );

  export const CalendarEventUpdateSchema = CalendarEventFieldsSchema.partial()
    .extend({ isActive: z.boolean().optional() })
    .refine(
      (value) =>
        value.startAt === undefined ||
        value.endAt === undefined ||
        Date.parse(value.endAt) >= Date.parse(value.startAt),
      { message: "calendar_end_before_start", path: ["endAt"] },
    );

  export const CalendarEventPresentationUpdateSchema = z.object({
    categoryOverride: z.enum(["EVENT", "ACADEMIC", "HOLIDAY"]).nullable().optional(),
    isHiddenByAdmin: z.boolean().optional(),
  }).refine(
    (value) => value.categoryOverride !== undefined || value.isHiddenByAdmin !== undefined,
    { message: "calendar_presentation_update_required" },
  );

  export const CalendarIcsImportSchema = z.object({
    ics: z.string().min(1).max(2_000_000),
  });

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
  homeVisible: z.boolean().optional(),
  homeOrder: z.number().int().nullable().optional(),
  isSecret: z.boolean().optional(),
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
  homeVisible: z.boolean().optional(),
  homeOrder: z.number().int().nullable().optional(),
  isSecret: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  assets: ArticleAssetsSchema.optional(),
  eventStartDate: z.string().nullable().optional(),
  eventEndDate: z.string().nullable().optional(),
  eventDescriptionKo: z.string().nullable().optional(),
  eventDescriptionEn: z.string().nullable().optional(),
});

export const ArticleModerationSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

export const FaqReorderSchema = z.object({
  items: z.array(z.object({
    articleId: z.string().regex(/^\d+$/),
    sortOrder: z.number().int().min(0),
  }).strict()).min(1).max(100),
}).strict();

export const ArticleDraftSaveSchema = z.object({
  draftId: z.string().uuid().optional(),
  boardCode: z.string().trim().min(1).max(20),
  targetArticleId: z.string().regex(/^\d+$/).nullable().optional(),
  titleKo: z.string().max(255).default(""),
  titleEn: z.string().max(255).nullable().optional(),
  contentKo: z.string().max(50_000).default(""),
  contentEn: z.string().max(50_000).nullable().optional(),
  visibilityScope: VisibilityScopeSchema.default("PUBLIC"),
  isPinned: z.boolean().default(false),
  pinOrder: z.number().int().nullable().optional(),
  homeVisible: z.boolean().default(true),
  homeOrder: z.number().int().nullable().optional(),
  isSecret: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  allowComment: z.boolean().default(true),
  isKoreanOnly: z.boolean().default(false),
  assets: ArticleAssetsSchema.optional(),
  eventStartDate: z.string().nullable().optional(),
  eventEndDate: z.string().nullable().optional(),
  eventDescriptionKo: z.string().nullable().optional(),
  eventDescriptionEn: z.string().nullable().optional(),
  linkedSurveyId: z.string().uuid().nullable().optional(),
  fingerprint: z.string().trim().min(1).max(128),
  expectedVersion: z.number().int().positive().optional(),
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
const SurveyKindSchema = z.enum(["SURVEY", "APPLICATION"]);
const SurveyFeeRequirementPolicySchema = z.enum(["NONE", "PAID_ONLY"]);
export const SurveySocAffiliationSchema = z.enum(["PRIMARY", "DOUBLE", "MINOR"]);
export const SurveyAcademicEligibilitySchema = z.enum([
  "ANY",
  "ENROLLED_ONLY",
  "ENROLLED_OR_LEAVE",
]);
const NullableSurveyDateTimeSchema = z.string().datetime({ offset: true }).nullable();
const SurveyRichTextSchema = z.string().max(50_000).optional();
const SurveyImageReferenceSchema = z.string().trim().max(2_000).refine(
  (value) => /^asset:\d+$/.test(value) || z.string().url().safeParse(value).success,
  "survey_image_invalid",
);

const SurveyFieldsSchema = z.object({
  kind: SurveyKindSchema,
  titleKo: z.string().min(1).max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: SurveyRichTextSchema,
  descriptionEn: SurveyRichTextSchema,
  descriptionImageUrlKo: SurveyImageReferenceSchema.nullable().optional(),
  descriptionImageUrlEn: SurveyImageReferenceSchema.nullable().optional(),
  feeRequirementPolicy: SurveyFeeRequirementPolicySchema.optional(),
  eligibleSocAffiliations: z.array(SurveySocAffiliationSchema).max(3).optional(),
  academicEligibility: SurveyAcademicEligibilitySchema.optional(),
  allowAnonymous: z.boolean().optional(),
  allowMultipleResponses: z.boolean().optional(),
  allowResponseEdit: z.boolean().optional(),
  isKoreanOnly: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  showOnCalendar: z.boolean().optional(),
  isAlwaysOpen: z.boolean().optional(),
  resultVisibility: SurveyResultVisibilitySchema.default("PRIVATE"),
  maxResponseCount: z.number().int().positive().nullable().optional(),
  openAt: NullableSurveyDateTimeSchema.optional(),
  closeAt: NullableSurveyDateTimeSchema.optional(),
  connectedArticleId: z.string().regex(/^\d+$/).nullable().optional(),
});

const validateSurveySchedule = (
  value: { isAlwaysOpen?: boolean; openAt?: string | null; closeAt?: string | null },
  context: z.RefinementCtx,
) => {
  if (value.isAlwaysOpen && (value.openAt || value.closeAt)) {
    context.addIssue({ code: "custom", message: "always_open_cannot_have_schedule", path: ["isAlwaysOpen"] });
  }
  if (value.openAt && value.closeAt && Date.parse(value.openAt) >= Date.parse(value.closeAt)) {
    context.addIssue({ code: "custom", message: "survey_invalid_schedule", path: ["closeAt"] });
  }
};

export const CreateSurveySchema = SurveyFieldsSchema.superRefine(validateSurveySchedule);

export const UpdateSurveySchema = SurveyFieldsSchema.partial().extend({
  // Do not apply the create-only default to PATCH requests.
  resultVisibility: SurveyResultVisibilitySchema.optional(),
}).superRefine(validateSurveySchedule);

export const CreateSectionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: SurveyRichTextSchema,
  descriptionEn: SurveyRichTextSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

export const QuestionTypeSchema = z.enum([
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "grid_single",
  "grid_multiple",
  "file_upload",
  "date",
  "time",
  "datetime",
]);

export const QuestionOptionSchema = z.object({
  value: z.string().min(1),
  labelKo: z.string().min(1),
  labelEn: z.string().optional(),
  imageUrlKo: SurveyImageReferenceSchema.nullable().optional(),
  imageUrlEn: SurveyImageReferenceSchema.nullable().optional(),
});

const QuestionOptionsSchema = z
  .array(QuestionOptionSchema)
  .max(100)
  .superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const value = item.value.trim();
      if (seen.has(value)) {
        context.addIssue({
          code: "custom",
          message: "question_option_value_must_be_unique",
          path: [index, "value"],
        });
      }
      seen.add(value);
    });
  });

export const QuestionConfigSchema = z.object({
  imageUrlKo: SurveyImageReferenceSchema.nullable().optional(),
  imageUrlEn: SurveyImageReferenceSchema.nullable().optional(),
  rows: QuestionOptionsSchema.optional(),
  columns: QuestionOptionsSchema.optional(),
  maxFiles: z.number().int().positive().max(10).optional(),
  maxSizeBytes: z.number().int().positive().max(20_000_000).optional(),
  allowedMimeTypes: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  // Google Forms-style section branching. Values are option IDs; targets are
  // section IDs or the terminal `SUBMIT` marker.
  goToSectionByValue: z
    .record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100))
    .optional(),
});

export const CreateQuestionSchema = z.object({
  titleKo: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionKo: SurveyRichTextSchema,
  descriptionEn: SurveyRichTextSchema,
  questionType: QuestionTypeSchema,
  options: QuestionOptionsSchema.optional(),
  config: QuestionConfigSchema.optional(),
  answerRegex: z.string().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateQuestionSchema = CreateQuestionSchema.partial();

const ReorderItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int().min(0),
}).strict();

const ReorderItemsSchema = z.object({
  items: z.array(ReorderItemSchema).min(1).max(200),
}).strict().superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length) {
    context.addIssue({ code: "custom", message: "survey_reorder_duplicate_id", path: ["items"] });
  }
  if (new Set(value.items.map((item) => item.sortOrder)).size !== value.items.length) {
    context.addIssue({ code: "custom", message: "survey_reorder_duplicate_position", path: ["items"] });
  }
});

export const ReorderSurveySectionsSchema = ReorderItemsSchema;
export const ReorderSurveyQuestionsSchema = ReorderItemsSchema;

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

export const RoleGroupMemberFilterSchema = z.object({
  q: z.string().optional(),
  department: z.string().optional(),
  academicStatus: z.string().optional(),
  majorType: z.enum(["PRIMARY", "DOUBLE", "MINOR"]).optional(),
  feeStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const ReplaceRoleGroupMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

export const UpdateUserActiveStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (!value.isActive && (!value.reason || value.reason.length < 2)) {
    context.addIssue({
      code: "custom",
      message: "deactivation_reason_required",
      path: ["reason"],
    });
  }
});

export const UpdateUserPostingSuspensionSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (value.suspended && (!value.reason || value.reason.length < 2)) {
    context.addIssue({
      code: "custom",
      message: "posting_suspension_reason_required",
      path: ["reason"],
    });
  }
});

// ─── Finance ─────────────────────────────────────────────────────────────────

export const UpdateStudentFeeStatusSchema = z
  .object({
    paidAmount: z.number().int().min(0).max(100_000_000).optional(),
    status: z.enum(["PAID", "PARTIAL", "UNPAID"]).optional(),
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

const StudentFeePaymentInputSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(0).max(100_000_000),
  paymentType: z.enum(["SIX_SEMESTER_LUMP_SUM", "PRIOR_PAYMENT_BALANCE"]),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "OTHER"]),
  effectiveStartSemester: z.string().regex(/^\d{4}-[12]$/, "invalid_reference_semester"),
  coverageSemesters: z.number().int().min(1).max(6),
  paidAt: z.string().datetime(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const BulkProcessStudentFeePaymentsSchema = z.object({
  payments: z.array(StudentFeePaymentInputSchema).min(1).max(1_000),
});

export const BulkUpdateStudentFeeStatusSchema = z.object({
  updates: z
    .array(
      z
        .object({
          userId: z.string().uuid().optional(),
          stdNo: z.string().trim().max(30).optional(),
          paidAmount: z.number().int().min(0).max(100_000_000).optional(),
          status: z.enum(["PAID", "PARTIAL", "UNPAID"]).optional(),
          coverageSemesters: z.number().int().positive().optional(),
          note: z.string().nullable().optional(),
        })
        .refine((value) => Boolean(value.userId || value.stdNo), {
          message: "user_id_or_student_number_required",
        })
        .refine(
          (value) =>
            value.paidAmount !== undefined ||
            value.status !== undefined ||
            value.coverageSemesters !== undefined ||
            value.note !== undefined,
          { message: "fee_status_update_required" },
        ),
    )
    .min(1)
    .max(1_000),
});

// ─── Executive Contacts ──────────────────────────────────────────────────────

const RequiredContactTextSchema = z.string().trim().min(1).max(100);

const ContactFieldsSchema = z.object({
  nameKo: RequiredContactTextSchema,
  nameEn: RequiredContactTextSchema,
  departmentKo: z.string().trim().max(100).nullable().optional(),
  departmentEn: z.string().trim().max(100).nullable().optional(),
  roleKo: RequiredContactTextSchema,
  roleEn: RequiredContactTextSchema,
  avatarStorageKey: z.string().regex(/^asset:\d+$/).nullable().optional(),
  gender: z.string().trim().max(20).nullable().optional(),
  cohort: z.number().int().positive().max(100).nullable().optional(),
  email: z.string().email().or(z.literal("")).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  privacyConsented: z.boolean(),
  sortOrder: z.number().int().optional(),
});

export const CreateContactSchema = ContactFieldsSchema.extend({
  privacyConsented: z.boolean().default(true),
});

export const ReorderContactsSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          sortOrder: z.number().int().min(0),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

// PATCH keeps the same validation and normalization rules as creation, but
// only applies them to fields the caller actually supplies.
export const UpdateContactSchema = ContactFieldsSchema.partial();

export const BulkImportContactsSchema = z.object({
  items: z.array(CreateContactSchema).min(1).max(500),
  replaceExisting: z.boolean().default(false),
});

// ─── Bulk Email ──────────────────────────────────────────────────────────────

export const BulkEmailRecipientFiltersSchema = z.object({
  query: z.string().trim().max(100).optional(),
  studentNumber: z.string().trim().max(30).optional(),
  primaryMajor: z.string().trim().max(100).optional(),
  doubleMajor: z.string().trim().max(100).optional(),
  minor: z.string().trim().max(100).optional(),
  academicStatus: z.string().trim().max(30).optional(),
});

const BulkEmailAttachmentIdsSchema = z
  .array(z.string().regex(/^\d+$/, "asset_id_invalid"))
  .max(10)
  .default([]);

export const SendBulkEmailSchema = z.object({
  subject: z.string().min(1).max(255),
  content: z.string().min(1),
  contentType: z.enum(["plain", "html"]).default("html"),
  recipientType: z.enum(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"]),
  filters: BulkEmailRecipientFiltersSchema.optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  attachmentAssetIds: BulkEmailAttachmentIdsSchema,
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export const SaveBulkEmailDraftSchema = z.object({
  draftId: z.string().uuid().optional(),
  subject: z.string().max(255).default(""),
  content: z.string().default(""),
  contentType: z.enum(["plain", "html"]).default("html"),
  recipientType: z.enum(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"]).default("ALL"),
  filters: BulkEmailRecipientFiltersSchema.optional(),
  attachmentAssetIds: BulkEmailAttachmentIdsSchema,
});

const BulkEmailContentTypeSchema = z.enum(["plain", "html"]);
const BulkEmailRecipientTypeSchema = z.enum([
  "ALL",
  "PAID_STUDENTS",
  "UNPAID_STUDENTS",
]);

export const CreateBulkEmailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
  subject: z.string().min(1).max(255),
  content: z.string().min(1).max(100_000),
  contentType: BulkEmailContentTypeSchema.default("html"),
  recipientType: BulkEmailRecipientTypeSchema.default("ALL"),
  filters: BulkEmailRecipientFiltersSchema.optional(),
});

export const UpdateBulkEmailTemplateSchema = CreateBulkEmailTemplateSchema.partial();
