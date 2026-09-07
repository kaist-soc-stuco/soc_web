import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleListItem,
  SurveyDetailResponse,
  CreateSurveyRequest,
  SurveySectionRecord,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { z } from "zod";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { htmlDatetimeLocalToIso, isoToDate, isoToHtmlDatetimeLocal, isoToMs } from "@soc/shared";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminPageHeader, AdminPageShell } from "@/components/ui/admin-page";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { Permissions } from "@/lib/permissions";
import {
  SurveySettingsForm,
  type SurveySettingsFormValues,
} from "@/components/organisms/survey-settings-form";
import { QuestionFormState, QuestionInlineEditor } from "@/components/organisms/question-editor-modal";
import {
  SectionEditorModal,
  type SectionFormState,
} from "@/components/organisms/section-editor-modal";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  MoreVertical,
  Move,
  Pencil,
  Plus,
  Save,
  Sheet,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRestoredBanner } from "@/components/ui/draft-restored-banner";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { AdminSelectDropdown } from "@/components/ui/admin-select";

const formatCompactDateTime = (value: string | null) => {
  if (!value) return "";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
};

const isoToHtmlDate = (value: string) => isoToHtmlDatetimeLocal(value).slice(0, 10);

const isAllDayRange = (openAt: string | null, closeAt: string | null) => {
  if (!openAt || !closeAt) return false;
  const start = isoToDate(openAt);
  const end = isoToDate(closeAt);
  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 23 &&
    end.getMinutes() === 59
  );
};

const SurveySettingsSchema = z.object({
  titleKo: z.string().max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionImageUrlKo: z.string().nullable().optional(),
  descriptionImageUrlEn: z.string().nullable().optional(),
  kind: z.enum(["SURVEY", "APPLICATION"]),
  resultVisibility: z.enum(["PRIVATE", "PUBLIC"]),
  feePayersOnly: z.boolean().optional(),
  eligibleSocAffiliations: z.array(z.enum(["PRIMARY"])),
  academicEligibility: z.enum(["ANY", "ENROLLED_ONLY"]),
  allowAnonymous: z.boolean().optional(),
  isKoreanOnly: z.boolean().optional(),
  allowMultipleResponses: z.boolean().optional(),
  allowResponseEdit: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  showOnCalendar: z.boolean().optional(),
  isAlwaysOpen: z.boolean().optional(),
  isAllDay: z.boolean().optional(),
  maxResponseCount: z
    .string()
    .optional()
    .refine((value: string | undefined) => !value || /^[0-9]+$/.test(value), {
      message: "숫자만 입력하세요.",
    }),
  openAt: z.string(),
  closeAt: z.string(),
  connectedArticleId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (
    data.allowAnonymous &&
    (data.feePayersOnly ||
      data.eligibleSocAffiliations.length > 0 ||
      data.academicEligibility !== "ANY")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "로그인 없이 응답을 허용하려면 소속·학적·과비 조건을 해제해야 합니다.",
      path: ["allowAnonymous"],
    });
  }
  if (!data.isAlwaysOpen) {
    if (!data.openAt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "시작 시각을 입력해주세요.",
        path: ["openAt"],
      });
    }
    if (data.openAt && data.closeAt && isoToMs(data.openAt) >= isoToMs(data.closeAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "종료 시각은 시작 시각 이후여야 합니다.",
        path: ["closeAt"],
      });
    }
  }
});

const emptyQuestion = (): QuestionFormState => ({
  titleKo: "",
  titleEn: "",
  descriptionKo: "",
  descriptionEn: "",
  questionType: "short_text",
  options: [],
  answerRegex: "",
  answerValidationEnabled: false,
  isRequired: true,
  config: null,
});

const questionToFormState = (question: SurveyQuestionRecord): QuestionFormState => ({
  titleKo: question.titleKo,
  titleEn: question.titleEn ?? "",
  descriptionKo: question.descriptionKo ?? "",
  descriptionEn: question.descriptionEn ?? "",
  questionType: question.questionType,
  options: (question.options ?? []).map((option) => ({
    value: option.value,
    labelKo: option.labelKo,
    labelEn: option.labelEn ?? "",
    imageUrlKo: option.imageUrlKo ?? null,
    imageUrlEn: option.imageUrlEn ?? null,
  })),
  answerRegex: question.answerRegex ?? "",
  answerValidationEnabled: Boolean(
    question.answerRegex?.trim() ||
      question.config?.validationErrorMessage?.trim() ||
      question.config?.validationType,
  ),
  isRequired: question.isRequired ?? true,
  config: question.config,
});

const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const getSurveyErrorMessage = (err: unknown, fallback: string) => {
  const message = getErrorMessage(err, fallback);
  if (message.includes("survey_branch_must_target_later_section")) {
    return "섹션 이동 경로는 현재 섹션보다 뒤에 있는 섹션만 선택할 수 있습니다.";
  }
  if (message.includes("survey_branch_target_section_in_use")) {
    return "다른 문항의 이동 경로에서 사용 중인 섹션은 삭제할 수 없습니다.";
  }
  return message;
};

type SurveyEditorSection = SurveySectionRecord & { questions: SurveyQuestionRecord[] };

const compareSurveySectionOrder = (
  left: Pick<SurveySectionRecord, "id" | "sortOrder" | "createdAt">,
  right: Pick<SurveySectionRecord, "id" | "sortOrder" | "createdAt">,
) =>
  left.sortOrder - right.sortOrder ||
  left.createdAt.localeCompare(right.createdAt) ||
  left.id.localeCompare(right.id);

const cloneQuestionConfig = (config: SurveyQuestionRecord["config"]) =>
  config
    ? {
        ...config,
        rows: config.rows?.map((option) => ({ ...option })),
        columns: config.columns?.map((option) => ({ ...option })),
        goToSectionByValue: config.goToSectionByValue
          ? { ...config.goToSectionByValue }
          : undefined,
      }
    : undefined;

const QUESTION_ROW_CLASS =
  "group relative rounded-lg border border-slate-200 bg-white px-4 pb-5 pt-4 text-sm";

function QuestionDragHandleIcon() {
  return (
    <span aria-hidden="true" className="grid h-2 w-3 grid-cols-3 grid-rows-2 place-items-center gap-x-0.5 gap-y-0.5">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="size-0.5 rounded-full bg-current" />
      ))}
    </span>
  );
}

function isInteractiveQuestionRowTarget(
  target: EventTarget | null,
  currentTarget: Element,
): boolean {
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest(
    "button, a, input, select, textarea, [role='button']",
  );
  return Boolean(interactiveTarget && interactiveTarget !== currentTarget);
}

type QuestionRowContentProps = {
  question: SurveyQuestionRecord;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_text: "단답형",
  long_text: "장문형",
  single_choice: "객관식 질문",
  multiple_choice: "체크박스",
  dropdown: "드롭다운",
  rating: "등급",
  grid_single: "객관식 그리드",
  grid_multiple: "체크박스 그리드",
  file_upload: "파일 업로드",
  date: "날짜",
  time: "시간",
  datetime: "날짜+시간",
};

function QuestionOptionPreview({
  questionType,
  options,
}: {
  questionType: SurveyQuestionRecord["questionType"];
  options: NonNullable<SurveyQuestionRecord["options"]>;
}) {
  const fallbackOptions = options.length > 0
    ? options
    : [{ value: "option_1", labelKo: "옵션 1", labelEn: "Option 1" }];
  const isDropdown = questionType === "dropdown";
  const isMultiple = questionType === "multiple_choice";

  return (
    <div className="mt-3 grid max-w-2xl gap-2 text-xs text-slate-700">
      {fallbackOptions.slice(0, 8).map((option, index) => (
        <div key={`${option.value}-${index}`} className="flex min-w-0 items-center gap-2">
          {isDropdown ? (
            <span className="w-4 shrink-0 text-center tabular-nums text-slate-500">
              {index + 1}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={`size-4 shrink-0 border border-slate-300 bg-white ${isMultiple ? "rounded" : "rounded-full"}`}
            />
          )}
          <span className="min-w-0 truncate">
            {option.labelKo?.trim() || `옵션 ${index + 1}`}
          </span>
        </div>
      ))}
      {fallbackOptions.length > 8 ? (
        <span className="text-xs text-slate-400">외 {fallbackOptions.length - 8}개</span>
      ) : null}
    </div>
  );
}

function QuestionPreview({ question }: { question: SurveyQuestionRecord }) {
  const hasDescription = Boolean(
    question.descriptionKo?.trim() || question.descriptionEn?.trim(),
  );

  switch (question.questionType) {
    case "short_text":
      return (
        <div className="mt-3 max-w-md space-y-2 text-xs text-slate-500">
          {hasDescription ? <span className="block text-slate-600">설명</span> : null}
          <div className="w-3/4 border-b border-dotted border-slate-400 pb-1">
            단답형 텍스트
          </div>
        </div>
      );
    case "long_text":
      return (
        <div className="mt-3 max-w-2xl border-b border-dotted border-slate-400 pb-1 text-xs text-slate-500">
          장문형 텍스트
        </div>
      );
    case "single_choice":
    case "multiple_choice":
    case "dropdown":
      return (
        <QuestionOptionPreview
          questionType={question.questionType}
          options={question.options ?? []}
        />
      );
    default:
      return (
        <div className="mt-3 text-xs text-slate-400">
          {QUESTION_TYPE_LABELS[question.questionType] ?? "문항"}
        </div>
      );
  }
}

function QuestionRowContent({
  question,
}: QuestionRowContentProps) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
          {question.titleKo || "질문"}
          {question.titleEn?.trim() ? (
            <span className="ml-1 font-normal text-slate-400">({question.titleEn.trim()})</span>
          ) : null}
        </span>
        {question.isRequired ? (
          <span
            aria-label="필수 응답"
            className="shrink-0 text-sm font-semibold text-red-500"
            title="필수 응답"
          >
            *
          </span>
        ) : null}
      </div>
      <QuestionPreview question={question} />
    </div>
  );
}

function CollapsedQuestionRow({
  question,
  onEdit,
}: {
  question: SurveyQuestionRecord;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-left text-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-1 font-semibold text-slate-700">
        <span className="min-w-0 truncate">
          {question.titleKo || "질문"}
          {question.titleEn?.trim() ? (
            <span className="ml-1 font-normal text-slate-400">({question.titleEn.trim()})</span>
          ) : null}
        </span>
        {question.isRequired ? (
          <span aria-label="필수 응답" className="shrink-0 font-semibold text-red-500">*</span>
        ) : null}
      </span>
    </button>
  );
}

function SectionNavigationSelect({
  section,
  sectionIndex,
  sections,
  disabled,
  onChange,
}: {
  section: SurveyEditorSection;
  sectionIndex: number;
  sections: SurveyEditorSection[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const laterSections = sections.slice(sectionIndex + 1);
  const options = [
    { value: "", label: "다음 섹션으로 진행하기" },
    ...laterSections.map((target, index) => ({
      value: target.id,
      label: `${sectionIndex + index + 2} 섹션(${target.titleKo || "제목 없음"})으로 이동`,
    })),
    { value: "SUBMIT", label: "설문지 제출" },
  ];
  const selectedValue = options.some((option) => option.value === section.nextSectionId)
    ? section.nextSectionId ?? ""
    : "";

  return (
    <AdminSelectDropdown
      ariaLabel={`${section.titleKo || "섹션"} 다음 이동`}
      value={selectedValue}
      options={options}
      onChange={onChange}
      disabled={disabled}
      className="w-fit min-w-56 shrink-0"
      buttonClassName="!h-9 !border-0 !bg-transparent !px-2 !text-sm !font-normal !text-slate-600 !shadow-none hover:!bg-slate-50"
      menuClassName="min-w-64"
    />
  );
}

type SortableQuestionRowProps = {
  question: SurveyQuestionRecord;
  isOngoing: boolean;
  onEdit: () => void;
  isEditing?: boolean;
  editor?: (dragHandle: ReactNode) => ReactNode;
};

function SortableQuestionRow({
  question,
  isOngoing,
  onEdit,
  isEditing = false,
  editor,
}: SortableQuestionRowProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: isOngoing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={`${question.titleKo} 순서 이동`}
      {...attributes}
      {...listeners}
      className="flex size-4 shrink-0 touch-none select-none cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-kaist-grey/35 transition-colors hover:bg-slate-100 hover:text-kaist-grey/80 active:cursor-grabbing"
    >
      <QuestionDragHandleIcon />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      role={isEditing ? undefined : "button"}
      tabIndex={isEditing ? undefined : 0}
      aria-label={isEditing ? undefined : `${question.titleKo} 문항 편집`}
      onClick={
        isEditing
          ? undefined
          : (event) => {
              if (isInteractiveQuestionRowTarget(event.target, event.currentTarget)) return;
              onEdit();
            }
      }
      onKeyDown={
        isEditing
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit();
              }
            }
      }
      className={
        isEditing
          ? `w-full cursor-default border-0 bg-transparent p-0 shadow-none ${isDragging ? "relative z-0 opacity-0" : ""}`
          : `${QUESTION_ROW_CLASS} transition-[background-color,border-color,box-shadow] duration-100 ${
              isDragging
                ? "relative z-0 select-none opacity-0"
                : "cursor-pointer select-none hover:border-slate-300 hover:bg-slate-50/60"
            }`
      }
    >
      {isEditing && editor ? editor(dragHandle) : (
        <>
          {!isOngoing ? (
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
              {dragHandle}
            </div>
          ) : null}
          <QuestionRowContent question={question} />
        </>
      )}
    </div>
  );
}

function QuestionDragOverlayRow({
  question,
  isOngoing,
  width,
}: Pick<SortableQuestionRowProps, "question" | "isOngoing"> & { width: number | null }) {
  return (
    <div
      style={{ width: width ?? undefined }}
      className={`${QUESTION_ROW_CLASS} relative z-50 select-none cursor-grabbing border-brand-primary/45 shadow-lg`}
    >
      {!isOngoing ? (
        <span className="absolute left-1/2 top-0 z-10 flex size-4 -translate-x-1/2 items-center justify-center text-brand-primary">
          <QuestionDragHandleIcon />
        </span>
      ) : null}
      <QuestionRowContent question={question} />
    </div>
  );
}

export function SurveyEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const isEdit = Boolean(surveyId);
  const skipDraftRestore = Boolean(
    (location.state as { skipDraftRestore?: boolean } | null)?.skipDraftRestore,
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const form = useForm<SurveySettingsFormValues>({
    resolver: zodResolver(SurveySettingsSchema),
    defaultValues: {
      titleKo: "",
      titleEn: "",
      descriptionKo: "",
      descriptionEn: "",
      descriptionImageUrlKo: null,
      descriptionImageUrlEn: null,
      kind: "SURVEY",
      resultVisibility: "PRIVATE",
      feePayersOnly: false,
      eligibleSocAffiliations: [],
      academicEligibility: "ANY",
      allowAnonymous: false,
      isKoreanOnly: false,
      allowMultipleResponses: false,
      allowResponseEdit: false,
      isPublished: false,
  showOnCalendar: false,
  isAlwaysOpen: false,
  isAllDay: false,
      maxResponseCount: "",
      openAt: "",
      closeAt: "",
      connectedArticleId: "",
    },
  });

  const isKoreanOnly = Boolean(form.watch("isKoreanOnly"));
  const isPublished = Boolean(form.watch("isPublished"));
  const [loadedLifecycleStatus, setLoadedLifecycleStatus] = useState<
    SurveyDetailResponse["lifecycleStatus"] | null
  >(null);
  // Existing responses are immutable snapshots, not a reason to freeze the
  // current survey definition. General surveys and applications stay
  // editable after publication and after responses have been submitted.
  const isOngoing = false;

  const [articleSearchResults, setArticleSearchResults] = useState<ArticleListItem[]>([]);
  const [selectedArticleTitle, setSelectedArticleTitle] = useState<string | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<{
    articleId: string;
    title: string;
    eventStartDate: string;
    eventEndDate: string;
  } | null>(null);

  const [sections, setSections] = useState<SurveyEditorSection[]>([]);
  const [tab, setTab] = useState<"content" | "delivery">("content");
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [sectionMenuOpenId, setSectionMenuOpenId] = useState<string | null>(null);
  const [sectionMoveOpenId, setSectionMoveOpenId] = useState<string | null>(null);

  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "creating" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionTitleEn, setNewSectionTitleEn] = useState("");
  const [sectionAddOpenId, setSectionAddOpenId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<{
    sectionId: string;
    questionId?: string;
    initial: QuestionFormState;
  } | null>(null);
  const [editingSection, setEditingSection] = useState<{
    sectionId: string;
    initial: SectionFormState;
  } | null>(null);
  const orderedSections = useMemo(
    () => [...sections].sort(compareSurveySectionOrder),
    [sections],
  );
  const branchTargetsForEditing = useMemo(() => {
    if (!editingQuestion) return [];
    const currentIndex = orderedSections.findIndex((section) => section.id === editingQuestion.sectionId);
    return orderedSections.slice(currentIndex >= 0 ? currentIndex + 1 : 0).map((section) => ({
      id: section.id,
      titleKo: section.titleKo,
    }));
  }, [editingQuestion, orderedSections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
  const questionCommitRef = useRef<(() => boolean) | null>(null);
  const creatingDraftRef = useRef<Promise<string> | null>(null);
  const initialDraftLoadAttemptedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (sessionLoading) return;
      if (!session?.authenticated) {
        navigate("/login");
        return;
      }
      const userPermission = session.permission ?? 0;
      if (!(userPermission & Permissions.MANAGE_SURVEY)) {
        toast({ type: "error", message: "권한이 없습니다." });
        navigate("/");
        return;
      }

      if (isEdit && surveyId) {
        try {
          const detail: SurveyDetailResponse = await client.getSurveyDetail(surveyId);
          const allDay = isAllDayRange(detail.opensAt, detail.closesAt);
          const allowAnonymous = detail.allowAnonymous ?? false;
          const eligibleSocAffiliations = allowAnonymous
            ? []
            : detail.eligibleSocAffiliations ?? [];
          const academicEligibility = allowAnonymous
            ? "ANY"
            : detail.academicEligibility === "ANY"
              ? "ANY"
              : "ENROLLED_ONLY";
          form.reset({
            titleKo: detail.titleKo,
            titleEn: detail.titleEn ?? "",
            descriptionKo: detail.descriptionKo ?? "",
            descriptionEn: detail.descriptionEn ?? "",
            descriptionImageUrlKo: detail.descriptionImageUrlKo ?? null,
            descriptionImageUrlEn: detail.descriptionImageUrlEn ?? null,
            kind: (["SURVEY", "APPLICATION"] as const).includes(
              detail.kind as SurveySettingsFormValues["kind"],
            ) ? detail.kind as SurveySettingsFormValues["kind"] : "SURVEY",
            resultVisibility:
              detail.resultVisibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
            feePayersOnly: allowAnonymous ? false : detail.feePayersOnly,
            eligibleSocAffiliations,
            academicEligibility,
            allowAnonymous,
            isKoreanOnly: detail.isKoreanOnly ?? false,
            allowMultipleResponses: detail.allowMultipleResponses ?? false,
            allowResponseEdit: detail.allowResponseEdit ?? false,
            isPublished: detail.isPublished ?? false,
            showOnCalendar: detail.showOnCalendar ?? false,
            isAlwaysOpen: detail.isAlwaysOpen ?? false,
            isAllDay: allDay,
            maxResponseCount:
              detail.maxResponses != null ? String(detail.maxResponses) : "",
            openAt: detail.opensAt
              ? allDay
                ? isoToHtmlDate(detail.opensAt)
                : isoToHtmlDatetimeLocal(detail.opensAt)
              : "",
            closeAt: detail.closesAt
              ? allDay
                ? isoToHtmlDate(detail.closesAt)
                : isoToHtmlDatetimeLocal(detail.closesAt)
              : "",
            connectedArticleId: detail.connectedPostId ?? "",
          });
          setSections(detail.sections);
          setLoadedSurveyId(surveyId);
          setSpreadsheetUrl(detail.spreadsheetUrl ?? null);
          setLoadedLifecycleStatus(detail.lifecycleStatus);
          if (detail.lifecycleStatus === "DRAFT") {
            setDraftRestoredAt(detail.updatedAt);
            setDraftBannerVisible(true);
          } else {
            setDraftRestoredAt(null);
            setDraftBannerVisible(false);
          }

          if (detail.connectedPostId) {
            client.searchArticles(detail.connectedPostId, 1).then(results => {
              const matched = results.find(r => r.articleId === detail.connectedPostId);
              if (matched) setSelectedArticleTitle(matched.titleKo);
            });
          }
        } catch (err: unknown) {
          console.error(err);
          setError("설문조사를 불러오지 못했습니다.");
        }
      }
    })();
  }, [isEdit, surveyId, navigate, form, session, sessionLoading]);

  const buildSurveyBody = (
    values: SurveySettingsFormValues,
    options?: { allowPlaceholder?: boolean; publish?: boolean },
  ): CreateSurveyRequest => {
    const allowPlaceholder = options?.allowPlaceholder ?? false;
    const maxResponseCount = values.maxResponseCount?.trim()
      ? Number(values.maxResponseCount)
      : undefined;
    const allowAnonymous = Boolean(values.allowAnonymous);
    const feePayersOnly = allowAnonymous ? false : Boolean(values.feePayersOnly);
    const eligibleSocAffiliations = allowAnonymous
      ? []
      : values.eligibleSocAffiliations;
    const academicEligibility = allowAnonymous ? "ANY" : values.academicEligibility;
    const isPublishing = options?.publish ?? values.isPublished;

    return {
      kind: values.kind,
      titleKo: values.titleKo.trim() || "설문조사",
      titleEn: values.titleEn?.trim() || (!values.isKoreanOnly && isPublishing ? "Survey" : undefined),
      descriptionKo: values.descriptionKo?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      descriptionImageUrlKo: values.descriptionImageUrlKo ?? null,
      descriptionImageUrlEn: values.descriptionImageUrlEn ?? null,
      feeRequirementPolicy: feePayersOnly ? "PAID_ONLY" : "NONE",
      eligibleSocAffiliations,
      academicEligibility,
      allowAnonymous,
      allowMultipleResponses: values.allowMultipleResponses,
      allowResponseEdit: values.allowMultipleResponses ? false : values.allowResponseEdit,
      isKoreanOnly: values.isKoreanOnly,
      isPublished: options?.publish ?? values.isPublished,
      showOnCalendar: values.showOnCalendar,
      isAlwaysOpen: values.isAlwaysOpen || (allowPlaceholder && !values.openAt),
      resultVisibility: values.resultVisibility,
      maxResponseCount,
      openAt: values.isAlwaysOpen || (allowPlaceholder && !values.openAt)
        ? null
        : values.openAt
          ? htmlDatetimeLocalToIso(
              values.isAllDay && !values.openAt.includes("T")
                ? `${values.openAt}T00:00`
                : values.openAt,
            )
          : undefined,
      closeAt: values.isAlwaysOpen || !values.closeAt
        ? null
        : htmlDatetimeLocalToIso(
            values.isAllDay && !values.closeAt.includes("T")
              ? `${values.closeAt}T23:59`
              : values.closeAt,
          ),
      connectedArticleId: values.connectedArticleId?.trim() || null,
    };
  };

  const ensureDraft = async (): Promise<string> => {
    if (loadedSurveyId) return loadedSurveyId;
    if (creatingDraftRef.current) return creatingDraftRef.current;

    creatingDraftRef.current = (async () => {
      setSaveState("creating");
      setError(null);
      try {
        const created = await client.createSurvey(
          buildSurveyBody(form.getValues(), { allowPlaceholder: true, publish: false }),
        );
        const section = await client.createSection(created.id, {
          titleKo: "기본 섹션",
          titleEn: form.getValues("isKoreanOnly") ? undefined : "Default section",
        });
        const detail = await client.getSurveyDetail(created.id);
        setLoadedSurveyId(created.id);
        setSpreadsheetUrl(detail.spreadsheetUrl ?? null);
        setLoadedLifecycleStatus(detail.lifecycleStatus);
        setSections(detail.sections.length ? detail.sections : [{ ...section, questions: [] }]);
        setDraftRestoredAt(detail.updatedAt);
        setDraftBannerVisible(true);
        form.setValue("isPublished", false);
        setSaveState("saved");
        navigate(`/admin/surveys/${created.id}/edit`, { replace: true });
        return created.id;
      } catch (err: unknown) {
        setSaveState("error");
        setError(getErrorMessage(err, "초안을 만들지 못했습니다."));
        throw err;
      } finally {
        creatingDraftRef.current = null;
      }
    })();

    return creatingDraftRef.current;
  };

  useEffect(() => {
    if (sessionLoading || !session?.authenticated) return;
    if ((session.permission ?? 0) & Permissions.MANAGE_SURVEY) {
      if (isEdit) {
        // Allow the restore check to run again when the user chooses "새로 쓰기".
        initialDraftLoadAttemptedRef.current = false;
        return;
      }
      if (skipDraftRestore) {
        initialDraftLoadAttemptedRef.current = true;
        return;
      }
      if (initialDraftLoadAttemptedRef.current) return;
      initialDraftLoadAttemptedRef.current = true;

      void (async () => {
        try {
          const drafts = await client.listSurveys();
          const currentUserDrafts = drafts
            .filter((survey) => survey.lifecycleStatus === "DRAFT")
            .filter((survey) => !session.userId || survey.creatorId === session.userId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          const draft = currentUserDrafts[0];
          if (draft) {
            navigate(`/admin/surveys/${draft.id}/edit`, { replace: true });
            return;
          }

          await ensureDraft();
        } catch {
          // The editor can still be used without automatic draft restoration;
          // the normal save/content-tab flow will report any creation error.
        }
      })();
    }
  }, [isEdit, navigate, session, sessionLoading, skipDraftRestore]);

  const handleSaveSettings = async (
    values: SurveySettingsFormValues,
    options?: { publish?: boolean },
  ) => {
    setSaving(true);
    setSaveState("saving");
    setError(null);
    try {
      const id = loadedSurveyId ?? await ensureDraft();
      const body = buildSurveyBody(values, { publish: options?.publish });
      const updated = await client.updateSurvey(id, body);
      form.setValue("isPublished", updated.isPublished ?? Boolean(options?.publish));
      setSpreadsheetUrl(updated.spreadsheetUrl ?? null);
      setLoadedLifecycleStatus(updated.lifecycleStatus);
      setSaveState("saved");
    } catch (err: unknown) {
      console.error(err);
      setSaveState("error");
      setError(getErrorMessage(err, "저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const handleSheet = async () => {
    if (!loadedSurveyId || sheetBusy) return;
    if (spreadsheetUrl) {
      window.open(spreadsheetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setSheetBusy(true);
    try {
      const updated = await client.connectSurveySpreadsheet(loadedSurveyId);
      setSpreadsheetUrl(updated.spreadsheetUrl ?? null);
      if (updated.spreadsheetUrl) {
        window.open(updated.spreadsheetUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast({
        type: "error",
        message: "Google Sheets를 연결하지 못했습니다. Google 계정 연결과 OAuth 권한을 확인해주세요.",
      });
    } finally {
      setSheetBusy(false);
    }
  };

  const handleTabChange = async (nextTab: "content" | "delivery") => {
    if (nextTab === "content" && !loadedSurveyId) {
      try {
        await ensureDraft();
      } catch {
        return;
      }
    }
    setTab(nextTab);
  };

  useEffect(() => {
    if (!sectionMenuOpenId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-section-menu]")) return;
      setSectionMenuOpenId(null);
      setSectionMoveOpenId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (sectionMoveOpenId) {
        setSectionMoveOpenId(null);
      } else {
        setSectionMenuOpenId(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sectionMenuOpenId, sectionMoveOpenId]);

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSectionIds((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleStartNewSurvey = () => {
    setDraftBannerVisible(false);
    setDraftRestoredAt(null);
    setLoadedSurveyId(null);
    setSpreadsheetUrl(null);
    setLoadedLifecycleStatus(null);
    setSections([]);
    setCollapsedSectionIds(new Set());
    setSectionMenuOpenId(null);
    setSectionMoveOpenId(null);
    setError(null);
    setSaveState("idle");
    form.reset();
    navigate("/admin/surveys/new", { state: { skipDraftRestore: true } });
  };

  const handleAddSection = async () => {
    if (!loadedSurveyId || !newSectionTitle.trim()) return;
    if (!isKoreanOnly && !newSectionTitleEn.trim()) {
      setError("영문 섹션 제목을 입력해주세요.");
      return;
    }
    setAddingSection(true);
    setError(null);
    try {
      await client.createSection(loadedSurveyId, {
        titleKo: newSectionTitle.trim(),
        titleEn: newSectionTitleEn.trim() || undefined,
      });
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setNewSectionTitle("");
      setNewSectionTitleEn("");
      setSectionAddOpenId(null);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "섹션 추가 실패"));
    } finally {
      setAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!loadedSurveyId) return;
    const section = sections.find((item) => item.id === sectionId);
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      title: "섹션 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{section?.titleKo || "이 섹션"}”</strong> 섹션을 삭제하시겠습니까?</>,
      warning: "(삭제된 섹션과 포함된 문항은 영구히 복구할 수 없습니다.)",
      tone: "danger",
    });
    if (!confirmed) return;

    setError(null);
    try {
      await client.deleteSection(loadedSurveyId, sectionId);
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setCollapsedSectionIds((previous) => {
        const next = new Set(previous);
        next.delete(sectionId);
        return next;
      });
      setSectionMenuOpenId(null);
      setSectionMoveOpenId(null);
    } catch (err: unknown) {
      console.error(err);
      setError(getSurveyErrorMessage(err, "섹션 삭제 실패"));
    }
  };

  const handleDuplicateSection = async (sectionId: string) => {
    if (!loadedSurveyId || !commitEditingQuestion()) return;
    const sourceIndex = orderedSections.findIndex((section) => section.id === sectionId);
    const source = sourceIndex >= 0 ? orderedSections[sourceIndex] : null;
    if (!source) return;

    setSectionMenuOpenId(null);
    setSectionMoveOpenId(null);
    setError(null);
    try {
      // Insert the empty section directly after the source first. This keeps
      // copied branch targets valid while its questions are being created.
      const created = await client.createSection(loadedSurveyId, {
        titleKo: source.titleKo,
        titleEn: source.titleEn ?? undefined,
        descriptionKo: source.descriptionKo ?? undefined,
        descriptionEn: source.descriptionEn ?? undefined,
        sortOrder: source.sortOrder + 1,
      });
      const afterCreate = await client.getSurveyDetail(loadedSurveyId);
      const afterCreateOrdered = [...afterCreate.sections].sort(compareSurveySectionOrder);
      const createdIndex = afterCreateOrdered.findIndex((section) => section.id === created.id);
      const insertIndex = Math.min(sourceIndex + 1, afterCreateOrdered.length - 1);
      const reorderedSections = createdIndex >= 0 && createdIndex !== insertIndex
        ? arrayMove(afterCreateOrdered, createdIndex, insertIndex)
        : afterCreateOrdered;
      await client.reorderSurveySections(loadedSurveyId, {
        items: reorderedSections.map((section, index) => ({ id: section.id, sortOrder: index })),
      });

      if (source.nextSectionId) {
        await client.updateSection(loadedSurveyId, created.id, {
          nextSectionId: source.nextSectionId,
        });
      }

      for (const [index, question] of source.questions.entries()) {
        await client.createQuestion(loadedSurveyId, created.id, {
          titleKo: question.titleKo,
          titleEn: question.titleEn ?? undefined,
          descriptionKo: question.descriptionKo ?? undefined,
          descriptionEn: question.descriptionEn ?? undefined,
          questionType: question.questionType,
          options: question.options?.map((option) => ({ ...option })) ?? undefined,
          config: cloneQuestionConfig(question.config),
          answerRegex: question.answerRegex ?? undefined,
          isRequired: question.isRequired,
          sortOrder: index,
        });
      }

      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setCollapsedSectionIds((previous) => {
        const next = new Set(previous);
        next.delete(created.id);
        return next;
      });
      toast({ type: "success", message: "섹션이 복제되었습니다." });
    } catch (err: unknown) {
      console.error(err);
      setError(getSurveyErrorMessage(err, "섹션 복제 실패"));
    }
  };

  const canMoveSectionTo = (sectionId: string, targetIndex: number) => {
    const sourceIndex = orderedSections.findIndex((section) => section.id === sectionId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return false;
    const movedSections = arrayMove(orderedSections, sourceIndex, targetIndex);
    return movedSections.every((section, index) => {
      const laterIds = new Set(movedSections.slice(index + 1).map((item) => item.id));
      const defaultTarget = section.nextSectionId;
      if (defaultTarget && defaultTarget !== "SUBMIT" && !laterIds.has(defaultTarget)) return false;
      return section.questions.every((question) =>
        Object.values(question.config?.goToSectionByValue ?? {}).every(
          (target) => target === "SUBMIT" || laterIds.has(target),
        ),
      );
    });
  };

  const handleMoveSection = async (sectionId: string, targetIndex: number) => {
    if (!loadedSurveyId || !commitEditingQuestion()) return;
    const sourceIndex = orderedSections.findIndex((section) => section.id === sectionId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    if (!canMoveSectionTo(sectionId, targetIndex)) {
      setError("답변에 따른 섹션 이동 경로를 유지할 수 없는 위치입니다.");
      return;
    }

    const previousSections = sections;
    const nextSections = arrayMove(orderedSections, sourceIndex, targetIndex).map(
      (section, index) => ({ ...section, sortOrder: index }),
    );
    setSectionMenuOpenId(null);
    setSectionMoveOpenId(null);
    setSections(nextSections);
    setError(null);
    try {
      const reordered = await client.reorderSurveySections(loadedSurveyId, {
        items: nextSections.map((section) => ({ id: section.id, sortOrder: section.sortOrder })),
      });
      const sortOrderById = new Map(reordered.map((section) => [section.id, section.sortOrder]));
      setSections((current) => current.map((section) => ({
        ...section,
        sortOrder: sortOrderById.get(section.id) ?? section.sortOrder,
      })));
    } catch (err: unknown) {
      console.error(err);
      setSections(previousSections);
      setError(getSurveyErrorMessage(err, "섹션 이동 실패"));
    }
  };

  const handleSectionNavigationChange = async (sectionId: string, target: string) => {
    if (!loadedSurveyId) return;
    const previousSections = sections;
    setSections((current) => current.map((section) =>
      section.id === sectionId
        ? { ...section, nextSectionId: target || null }
        : section,
    ));
    setError(null);
    try {
      await client.updateSection(loadedSurveyId, sectionId, {
        nextSectionId: target || null,
      });
    } catch (err: unknown) {
      console.error(err);
      setSections(previousSections);
      setError(getSurveyErrorMessage(err, "섹션 이동 설정 실패"));
    }
  };

  const openEditSection = (section: SurveySectionRecord) => {
    setEditingSection({
      sectionId: section.id,
      initial: {
        titleKo: section.titleKo,
        titleEn: section.titleEn ?? "",
        descriptionKo: section.descriptionKo ?? "",
        descriptionEn: section.descriptionEn ?? "",
      },
    });
  };

  const handleSaveSection = async (sectionForm: SectionFormState) => {
    if (!loadedSurveyId || !editingSection) return;
    setError(null);
    try {
      await client.updateSection(loadedSurveyId, editingSection.sectionId, {
        titleKo: sectionForm.titleKo.trim(),
        titleEn: sectionForm.titleEn.trim() || undefined,
        descriptionKo: sectionForm.descriptionKo.trim() || undefined,
        descriptionEn: sectionForm.descriptionEn.trim() || undefined,
      });
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setEditingSection(null);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "섹션 저장 실패"));
    }
  };

  const commitEditingQuestion = () => {
    if (!editingQuestion || !questionCommitRef.current) return true;
    return questionCommitRef.current();
  };

  const openNewQuestion = (sectionId: string) => {
    if (!commitEditingQuestion()) return;
    setCollapsedSectionIds((previous) => {
      const next = new Set(previous);
      next.delete(sectionId);
      return next;
    });
    setEditingQuestion({
      sectionId,
      initial: emptyQuestion(),
    });
  };

  const openEditQuestion = (sectionId: string, q: SurveyQuestionRecord) => {
    if (editingQuestion?.questionId === q.id) return;
    if (!commitEditingQuestion()) return;
    setCollapsedSectionIds((previous) => {
      const next = new Set(previous);
      next.delete(sectionId);
      return next;
    });
    setEditingQuestion({
      sectionId,
      questionId: q.id,
      initial: questionToFormState(q),
    });
  };

  const handleSaveQuestion = async (qForm: QuestionFormState) => {
    if (!loadedSurveyId || !editingQuestion) return;
    setError(null);
    const editingSnapshot = editingQuestion;
    const { sectionId, questionId } = editingSnapshot;
    let questionConfig = qForm.config ? { ...qForm.config } : undefined;
    if (questionConfig?.goToSectionByValue) {
      const currentSectionIndex = orderedSections.findIndex((section) => section.id === sectionId);
      const laterSectionIds = new Set(
        orderedSections.slice(currentSectionIndex + 1).map((section) => section.id),
      );
      const validBranchMap = Object.fromEntries(
        Object.entries(questionConfig.goToSectionByValue).filter(
          ([, target]) => target === "SUBMIT" || laterSectionIds.has(target),
        ),
      );
      if (Object.keys(validBranchMap).length > 0) {
        questionConfig.goToSectionByValue = validBranchMap;
      } else {
        delete questionConfig.goToSectionByValue;
        delete questionConfig.branchingEnabled;
      }
    }
    if (!qForm.answerValidationEnabled && questionConfig) {
      delete questionConfig.validationErrorMessage;
      delete questionConfig.validationType;
      delete questionConfig.validationTextType;
      delete questionConfig.validationOperator;
      delete questionConfig.validationValue;
      delete questionConfig.validationValueMax;
    }
    const body = {
      titleKo: qForm.titleKo.trim() || "질문",
      titleEn: qForm.titleEn.trim() || (isKoreanOnly ? undefined : "Question"),
      descriptionKo: qForm.descriptionKo.trim(),
      descriptionEn: qForm.descriptionEn.trim(),
      questionType: qForm.questionType,
      options: qForm.options.length > 0 ? qForm.options : undefined,
      config: questionConfig && Object.keys(questionConfig).length > 0 ? questionConfig : undefined,
      answerRegex: qForm.answerValidationEnabled
        ? qForm.answerRegex.trim() || undefined
        : undefined,
      isRequired: qForm.isRequired,
      ...(questionId
        ? {}
        : {
            sortOrder:
              sections.find((section) => section.id === sectionId)?.questions.length ?? 0,
          }),
    };

    try {
      if (questionId) {
        await client.updateQuestion(loadedSurveyId, sectionId, questionId, body);
      } else {
        await client.createQuestion(loadedSurveyId, sectionId, body);
      }
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setEditingQuestion((current) => (current === editingSnapshot ? null : current));
    } catch (err: unknown) {
      console.error(err);
      setError(getSurveyErrorMessage(err, "문항 저장 실패"));
    }
  };

  const handleDuplicateQuestion = async (sectionId: string, question: SurveyQuestionRecord) => {
    if (!loadedSurveyId) return;
    setError(null);

    const sourceSection = sections.find((section) => section.id === sectionId);
    const sourceIndex = sourceSection?.questions.findIndex((item) => item.id === question.id) ?? -1;

    try {
      const duplicated = await client.createQuestion(loadedSurveyId, sectionId, {
        titleKo: question.titleKo,
        titleEn: question.titleEn ?? undefined,
        descriptionKo: question.descriptionKo ?? "",
        descriptionEn: question.descriptionEn ?? "",
        questionType: question.questionType,
        options: question.options?.map((option) => ({ ...option })) ?? undefined,
        config: question.config
          ? {
              ...question.config,
              rows: question.config.rows?.map((option) => ({ ...option })),
              columns: question.config.columns?.map((option) => ({ ...option })),
              goToSectionByValue: question.config.goToSectionByValue
                ? { ...question.config.goToSectionByValue }
                : undefined,
            }
          : undefined,
        answerRegex: question.answerRegex ?? undefined,
        isRequired: question.isRequired,
        sortOrder: Math.max(0, question.sortOrder + 1),
      });
      const updated = await client.getSurveyDetail(loadedSurveyId);
      const duplicatedSection = updated.sections.find((section) => section.id === sectionId);
      if (!duplicatedSection) throw new Error("복제할 섹션을 찾을 수 없습니다.");

      const questions = duplicatedSection.questions.filter((item) => item.id !== duplicated.id);
      const insertIndex = sourceIndex >= 0
        ? Math.min(sourceIndex + 1, questions.length)
        : questions.length;
      questions.splice(insertIndex, 0, duplicated);
      const reordered = await client.reorderSurveyQuestions(loadedSurveyId, sectionId, {
        items: questions.map((item, sortOrder) => ({ id: item.id, sortOrder })),
      });
      const orderedQuestions = [...reordered].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
      );
      setSections(updated.sections.map((section) =>
        section.id === sectionId ? { ...section, questions: orderedQuestions } : section,
      ));
      setEditingQuestion({
        sectionId,
        questionId: duplicated.id,
        initial: questionToFormState(duplicated),
      });
      toast({ type: "success", message: "문항이 복제되었습니다." });
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "문항 복제 실패"));
    }
  };

  const handleUndoDeleteQuestion = async ({
    sectionId,
    question,
  }: {
    sectionId: string;
    question: SurveyQuestionRecord;
  }) => {
    if (!loadedSurveyId) return;
    setError(null);
    try {
      const restored = await client.createQuestion(loadedSurveyId, sectionId, {
        titleKo: question.titleKo,
        titleEn: question.titleEn ?? undefined,
        descriptionKo: question.descriptionKo ?? "",
        descriptionEn: question.descriptionEn ?? "",
        questionType: question.questionType,
        options: question.options?.map((option) => ({ ...option })) ?? undefined,
        config: question.config
          ? {
              ...question.config,
              rows: question.config.rows?.map((option) => ({ ...option })),
              columns: question.config.columns?.map((option) => ({ ...option })),
              goToSectionByValue: question.config.goToSectionByValue
                ? { ...question.config.goToSectionByValue }
                : undefined,
            }
          : undefined,
        answerRegex: question.answerRegex ?? undefined,
        isRequired: question.isRequired,
        sortOrder: question.sortOrder,
      });
      const updated = await client.getSurveyDetail(loadedSurveyId);
      const restoredSection = updated.sections.find((section) => section.id === sectionId);
      if (!restoredSection) throw new Error("복구할 섹션을 찾을 수 없습니다.");

      const questions = [...restoredSection.questions].filter((item) => item.id !== restored.id);
      const insertIndex = Math.min(Math.max(question.sortOrder, 0), questions.length);
      questions.splice(insertIndex, 0, restored);
      const reordered = await client.reorderSurveyQuestions(loadedSurveyId, sectionId, {
        items: questions.map((item, sortOrder) => ({ id: item.id, sortOrder })),
      });
      const orderedQuestions = [...reordered].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
      );
      setSections(updated.sections.map((section) =>
        section.id === sectionId ? { ...section, questions: orderedQuestions } : section,
      ));
      toast({ type: "success", message: "항목을 복구했습니다." });
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "항목을 복구하지 못했습니다."));
    }
  };

  const handleDeleteQuestion = async (sectionId: string, questionId: string) => {
    if (!loadedSurveyId) return;
    const question = sections
      .find((section) => section.id === sectionId)
      ?.questions.find((item) => item.id === questionId);
    if (!question) return;

    setError(null);
    try {
      await client.deleteQuestion(loadedSurveyId, sectionId, questionId);
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setEditingQuestion((current) => current?.questionId === questionId ? null : current);
      toast({
        type: "success",
        message: "항목이 삭제되었습니다.",
        duration: 7000,
        action: {
          label: "실행취소",
          onClick: () => void handleUndoDeleteQuestion({ sectionId, question }),
        },
      });
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "문항 삭제 실패"));
    }
  };

  const persistQuestionOrder = async (
    sectionId: string,
    questions: SurveyQuestionRecord[],
    backup: SurveyQuestionRecord[],
  ) => {
    if (!loadedSurveyId) return;

    try {
      await client.reorderSurveyQuestions(loadedSurveyId, sectionId, {
        items: questions.map((question, sortOrder) => ({ id: question.id, sortOrder })),
      });
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "순서 변경 실패"));
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, questions: backup } : section,
        ),
      );
    }
  };

  const handleQuestionDragStart = ({ active }: DragStartEvent) => {
    setActiveQuestionId(String(active.id));
    setActiveDragWidth(active.rect.current.initial?.width ?? null);
  };

  const handleQuestionDragCancel = () => {
    setActiveQuestionId(null);
    setActiveDragWidth(null);
  };

  const handleQuestionDragEnd = ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    setActiveQuestionId(null);
    setActiveDragWidth(null);

    if (!overId || activeId === overId) return;

    const sourceSection = sections.find((section) =>
      section.questions.some((question) => question.id === activeId),
    );
    const targetSection = sections.find((section) =>
      section.questions.some((question) => question.id === overId),
    );
    if (!sourceSection || !targetSection || sourceSection.id !== targetSection.id) return;

    const oldIndex = sourceSection.questions.findIndex((question) => question.id === activeId);
    const newIndex = sourceSection.questions.findIndex((question) => question.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const backup = sourceSection.questions;
    const nextQuestions = arrayMove(sourceSection.questions, oldIndex, newIndex);
    setSections((prev) =>
      prev.map((section) =>
        section.id === sourceSection.id
          ? { ...section, questions: nextQuestions }
          : section,
      ),
    );
    void persistQuestionOrder(sourceSection.id, nextQuestions, backup);
  };

  const handleFetchArticles = async (query = "") => {
    try {
      const results = await client.searchArticles(query, 30);
      setArticleSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectArticle = (articleId: string, title: string) => {
    const selectedArticle = articleSearchResults.find(a => a.articleId === articleId);
    if (
      selectedArticle &&
      selectedArticle.boardCode === "_EVENT" &&
      selectedArticle.eventStartDate &&
      selectedArticle.eventEndDate
    ) {
      setOverwriteTarget({
        articleId,
        title,
        eventStartDate: selectedArticle.eventStartDate,
        eventEndDate: selectedArticle.eventEndDate,
      });
    } else {
      form.setValue("connectedArticleId", articleId);
      setSelectedArticleTitle(title || null);
    }
  };

  const handleConfirmOverwrite = (yes: boolean) => {
    if (!overwriteTarget) return;
    const { articleId, title, eventStartDate, eventEndDate } = overwriteTarget;

    form.setValue("connectedArticleId", articleId);
    setSelectedArticleTitle(title);
    
    if (yes) {
      form.setValue("isAlwaysOpen", false);
      form.setValue("isAllDay", false);
      form.setValue("openAt", isoToHtmlDatetimeLocal(eventStartDate));
      form.setValue("closeAt", isoToHtmlDatetimeLocal(eventEndDate));
    }
    
    setOverwriteTarget(null);
  };

  const activeQuestion = activeQuestionId
    ? sections.flatMap((section) => section.questions).find((question) => question.id === activeQuestionId) ?? null
    : null;

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <AdminPageShell>
        {ConfirmDialog}
        <main className="admin-page__main mx-auto flex w-full max-w-[var(--ui-admin-editor-max-width)] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">

          <div className="sticky top-16 z-40 -mx-5 bg-[#f7f9fc]/95 px-5 pt-1 backdrop-blur md:-mx-8 md:px-8 xl:-mx-10 xl:px-10">
          <AdminPageHeader
            eyebrow={
              <button
                type="button"
                onClick={() => navigate("/admin/surveys")}
                className="inline-flex items-center gap-1 text-[length:var(--ui-text-caption-size)] font-semibold text-slate-500 transition-colors hover:text-brand-primary"
              >
                <ArrowLeft className="size-3.5" /> 목록으로
              </button>
            }
            title={form.watch("titleKo").trim() || (isEdit ? "설문조사 편집" : "새 설문조사")}
            actions={
              <>
                <span className={`mr-1 inline-flex items-center gap-1.5 text-xs font-normal ${saveState === "error" ? "text-rose-600" : "text-slate-500"}`}>
                  {saveState === "creating" || saveState === "saving" ? (
                    <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  {saveState === "creating"
                    ? "초안 만드는 중"
                    : saveState === "saving"
                      ? "저장 중"
                      : saveState === "error"
                      ? "저장 실패"
                      : saveState === "saved"
                          ? "저장됨"
                          : loadedSurveyId
                            ? loadedLifecycleStatus === "PUBLISHED"
                              ? "게시 중"
                              : "초안"
                            : "입력 중"}
                </span>
                {loadedSurveyId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sheetBusy}
                    className="gap-1.5"
                    onClick={() => void handleSheet()}
                  >
                    <Sheet className="size-4" /> Google Sheets에서 보기 ↗
                  </Button>
                ) : null}
                {loadedSurveyId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => window.open(`/survey/${loadedSurveyId}`, "_blank", "noopener,noreferrer")}
                  >
                    <Eye className="size-4" /> 미리보기
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  className="gap-1.5"
                  onClick={() => void form.handleSubmit((values) => handleSaveSettings(values))()}
                >
                  <Save className="size-4" /> 저장
                </Button>
                {!isPublished ? (
                  <Button
                    type="button"
                    disabled={saving}
                    className="bg-brand-primary text-white hover:bg-brand-primary/90"
                    onClick={() => void form.handleSubmit((values) => handleSaveSettings(values, { publish: true }))()}
                  >
                    게시
                  </Button>
                ) : null}
              </>
            }
          />
          </div>

          {draftBannerVisible && loadedLifecycleStatus === "DRAFT" ? (
            <DraftRestoredBanner
              savedAt={draftRestoredAt}
              onStartNew={handleStartNewSurvey}
              onDismiss={() => setDraftBannerVisible(false)}
            />
          ) : null}

          <SegmentedControl
            ariaLabel="설문 편집 단계"
            role="tablist"
            className="w-fit"
            value={tab}
            onChange={(value) => void handleTabChange(value)}
            options={[
              { value: "content", label: "질문" },
              { value: "delivery", label: "설정" },
            ]}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl text-sm font-semibold">
              {error}
            </div>
          )}

          {tab === "delivery" && (
            <FormProvider {...form}>
              <SurveySettingsForm
                mode="delivery"
                isOngoing={isOngoing}
                articleSearchResults={articleSearchResults}
                selectedArticleTitle={selectedArticleTitle}
                onFetchArticles={handleFetchArticles}
                onSelectArticle={handleSelectArticle}
                onSubmit={handleSaveSettings}
              />
            </FormProvider>
          )}

          {tab === "content" && (
            <div className="space-y-6">
              <FormProvider {...form}>
                <SurveySettingsForm
                  mode="basic"
                  isOngoing={isOngoing}
                  articleSearchResults={articleSearchResults}
                  selectedArticleTitle={selectedArticleTitle}
                  onFetchArticles={handleFetchArticles}
                  onSelectArticle={handleSelectArticle}
                  onSubmit={handleSaveSettings}
                />
              </FormProvider>

              {!loadedSurveyId ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-medium text-slate-400">
                  설문 문항을 준비 중입니다.
                </div>
              ) : (
                <>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleQuestionDragStart}
                      onDragCancel={handleQuestionDragCancel}
                      onDragEnd={handleQuestionDragEnd}
                    >
                    <div className="space-y-6">
                      {orderedSections.map((section, sectionIndex) => {
                        const isCollapsed = collapsedSectionIds.has(section.id);
                        const moveMenuOpen = sectionMoveOpenId === section.id;

                        return (
                           <section
                             key={section.id}
                             className="relative space-y-3"
                           >
                             <div className="relative overflow-visible rounded-lg border border-slate-200 bg-white">
                              <div className="flex min-w-0 items-start justify-between gap-4 px-5 py-4 md:px-6">
                                <div className="min-w-0">
                                  <div className="mb-1 text-xs font-medium text-slate-400">
                                    섹션 {sectionIndex + 1} / {orderedSections.length}
                                  </div>
                                  <h3 className="truncate text-lg font-semibold text-slate-900">
                                    {section.titleKo || "제목 없는 섹션"}
                                    {section.titleEn?.trim() ? (
                                      <span className="ml-1 text-sm font-normal text-slate-400">
                                        ({section.titleEn.trim()})
                                      </span>
                                    ) : null}
                                  </h3>
                                </div>
                                {!isOngoing ? (
                                  <div className="relative flex shrink-0 items-center gap-1" data-section-menu>
                                    <IconButton
                                      size="sm"
                                      aria-label={`${section.titleKo} 섹션 편집`}
                                      onClick={() => openEditSection(section)}
                                    >
                                      <Pencil className="size-4" />
                                    </IconButton>
                                    <IconButton
                                      size="sm"
                                      aria-label={isCollapsed ? `${section.titleKo} 섹션 펼치기` : `${section.titleKo} 섹션 접기`}
                                      aria-expanded={!isCollapsed}
                                      onClick={() => toggleSectionCollapsed(section.id)}
                                    >
                                      {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                                    </IconButton>
                                    <div className="relative">
                                      <IconButton
                                        size="sm"
                                        aria-label={`${section.titleKo} 섹션 더보기`}
                                        aria-expanded={sectionMenuOpenId === section.id}
                                        onClick={() => {
                                          setSectionMenuOpenId((current) => current === section.id ? null : section.id);
                                          setSectionMoveOpenId(null);
                                        }}
                                      >
                                        <MoreVertical className="size-4" />
                                      </IconButton>
                                      {sectionMenuOpenId === section.id ? (
                                        <div
                                          data-section-menu-popover
                                          className="scrollbar-hidden absolute left-0 top-full z-50 mt-2 max-h-80 w-60 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
                                        >
                                          {moveMenuOpen ? (
                                            <>
                                              <div className="px-3 py-2 text-xs font-medium text-slate-400">섹션 이동</div>
                                              {orderedSections.map((target, targetIndex) => {
                                                if (target.id === section.id) return null;
                                                const canMove = canMoveSectionTo(section.id, targetIndex);
                                                return (
                                                  <button
                                                    key={target.id}
                                                    type="button"
                                                    disabled={!canMove}
                                                    onClick={() => void handleMoveSection(section.id, targetIndex)}
                                                    className="flex min-h-9 w-full items-center rounded-md px-3 py-1.5 text-left text-sm font-normal text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    title={!canMove ? "답변에 따른 이동 경로를 유지할 수 없습니다." : undefined}
                                                  >
                                                    {targetIndex + 1} 섹션({target.titleKo || "제목 없음"})
                                                  </button>
                                                );
                                              })}
                                              <div className="my-1 border-t border-slate-100" />
                                              <button
                                                type="button"
                                                onClick={() => setSectionMoveOpenId(null)}
                                                className="flex min-h-9 w-full items-center rounded-md px-3 py-1.5 text-left text-sm font-normal text-slate-500 hover:bg-slate-50"
                                              >
                                                뒤로
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => void handleDuplicateSection(section.id)}
                                                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50"
                                              >
                                                <Copy className="size-4 shrink-0 text-slate-500" />
                                                섹션 복제
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setSectionMoveOpenId(section.id)}
                                                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50"
                                              >
                                                <Move className="size-4 shrink-0 text-slate-500" />
                                                섹션 이동
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleDeleteSection(section.id)}
                                                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-normal text-rose-600 hover:bg-rose-50"
                                              >
                                                <Trash2 className="size-4 shrink-0" />
                                                섹션 삭제
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                             <div className="space-y-3 pt-1">
                              {isCollapsed ? (
                                section.questions.map((question) => (
                                  <CollapsedQuestionRow
                                    key={question.id}
                                    question={question}
                                    onEdit={() => openEditQuestion(section.id, question)}
                                  />
                                ))
                              ) : (
                                <>
                                  {section.questions.length === 0 &&
                                    !(editingQuestion?.sectionId === section.id && !editingQuestion.questionId) && (
                                    <p className="py-6 text-center text-sm font-medium text-slate-400">
                                      등록된 질문이 없습니다.
                                    </p>
                                  )}

                                  <SortableContext
                                    items={section.questions.map((question) => question.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {section.questions.map((question) => {
                                      const isEditing = editingQuestion?.questionId === question.id;

                                      return (
                                        <SortableQuestionRow
                                          key={question.id}
                                          question={question}
                                          isOngoing={isOngoing}
                                          isEditing={isEditing}
                                          editor={
                                            isEditing
                                              ? (dragHandle) => (
                                                <QuestionInlineEditor
                                                  key={question.id}
                                                  initial={editingQuestion.initial}
                                                  isKoreanOnly={isKoreanOnly}
                                                  isOngoing={isOngoing}
                                                  currentSectionId={section.id}
                                                  branchTargets={branchTargetsForEditing}
                                                  isNewQuestion={false}
                                                  dragHandle={dragHandle}
                                                  commitRef={questionCommitRef}
                                                  onDuplicate={() => void handleDuplicateQuestion(section.id, question)}
                                                  onDelete={() => void handleDeleteQuestion(section.id, question.id)}
                                                  onSave={handleSaveQuestion}
                                                  onCancel={() => setEditingQuestion(null)}
                                                />
                                              )
                                              : undefined
                                          }
                                          onEdit={() => openEditQuestion(section.id, question)}
                                        />
                                      );
                                    })}
                                  </SortableContext>
                                  {editingQuestion?.sectionId === section.id && !editingQuestion.questionId ? (
                                    <QuestionInlineEditor
                                      key={`${section.id}-new`}
                                      initial={editingQuestion.initial}
                                      isKoreanOnly={isKoreanOnly}
                                      isOngoing={isOngoing}
                                      currentSectionId={section.id}
                                      branchTargets={branchTargetsForEditing}
                                      isNewQuestion
                                      commitRef={questionCommitRef}
                                      onSave={handleSaveQuestion}
                                      onCancel={() => setEditingQuestion(null)}
                                    />
                                  ) : null}
                                </>
                              )}
                              <div className="flex min-w-0 items-center justify-between gap-3 pt-2">
                                {!isOngoing ? (
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => openNewQuestion(section.id)}
                                      className="inline-flex shrink-0 items-center gap-1.5 border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-brand-primary hover:bg-emerald-50"
                                    >
                                      <Plus className="size-4" />
                                      문항 추가
                                    </Button>
                                    <div className="relative shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        aria-expanded={sectionAddOpenId === section.id}
                                        onClick={() => setSectionAddOpenId((current) => current === section.id ? null : section.id)}
                                        className="inline-flex items-center gap-1.5 border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-brand-primary hover:bg-emerald-50"
                                      >
                                        <Plus className="size-4" />
                                        섹션 추가
                                      </Button>
                                      {sectionAddOpenId === section.id ? (
                                        <div className="absolute bottom-full left-0 z-40 mb-2 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
                                          <div className="grid gap-2 sm:grid-cols-2">
                                            <UiInput
                                              autoFocus
                                              className="h-9 min-w-0 text-sm"
                                              placeholder="새 섹션 제목 (국문)"
                                              value={newSectionTitle}
                                              onChange={(event) => setNewSectionTitle(event.target.value)}
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") void handleAddSection();
                                              }}
                                            />
                                            <UiInput
                                              className={`h-9 min-w-0 text-sm ${isKoreanOnly ? "cursor-not-allowed opacity-50" : ""}`}
                                              placeholder="영문 섹션 제목"
                                              value={newSectionTitleEn}
                                              disabled={isKoreanOnly}
                                              onChange={(event) => setNewSectionTitleEn(event.target.value)}
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") void handleAddSection();
                                              }}
                                            />
                                          </div>
                                          <div className="mt-2 flex justify-end">
                                            <Button
                                              type="button"
                                              onClick={() => void handleAddSection()}
                                              disabled={addingSection || !newSectionTitle.trim()}
                                              className="h-9 bg-brand-primary px-3 text-sm text-white hover:bg-brand-primary/90"
                                            >
                                              {addingSection ? "추가 중…" : "섹션 추가"}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : <span />}
                                <SectionNavigationSelect
                                  section={section}
                                  sectionIndex={sectionIndex}
                                  sections={orderedSections}
                                  disabled={isOngoing}
                                  onChange={(value) => void handleSectionNavigationChange(section.id, value)}
                                />
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                    {typeof document !== "undefined"
                      ? createPortal(
                          <DragOverlay
                            dropAnimation={{ duration: 200, easing: "ease" }}
                          >
                            {activeQuestion ? (
                              <QuestionDragOverlayRow
                                question={activeQuestion}
                                isOngoing={isOngoing}
                                width={activeDragWidth}
                              />
                            ) : null}
                          </DragOverlay>,
                          document.body,
                        )
                      : null}
                    </DndContext>

                  </>
                )}
              </div>
            )}
        </main>

        {editingSection && (
          <SectionEditorModal
            initial={editingSection.initial}
            isKoreanOnly={isKoreanOnly}
            isOngoing={isOngoing}
            onSave={handleSaveSection}
            onCancel={() => setEditingSection(null)}
          />
        )}

        {overwriteTarget && (
          <Modal
            open
            onClose={() => handleConfirmOverwrite(false)}
            title="일정 정보 덮어쓰기"
            className="max-w-md"
            bodyClassName="space-y-4 px-6 py-5"
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleConfirmOverwrite(false)}
                >
                  유지하기
                </Button>
                <Button
                  type="button"
                  onClick={() => handleConfirmOverwrite(true)}
                  className="bg-kaist-darkgreen text-white hover:bg-kaist-darkgreen/90"
                >
                  덮어쓰기
                </Button>
              </>
            }
          >
            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-slate-700">
              <CalendarIcon className="mt-0.5 size-4 shrink-0 text-kaist-darkgreen" aria-hidden="true" />
              <p className="break-keep leading-6">
                선택한 행사 일정의 시작·마감 시간을 설문에 적용하시겠습니까?
              </p>
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">행사 시작</span>
                <span className="text-right font-medium text-slate-700">{formatCompactDateTime(overwriteTarget.eventStartDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">행사 마감</span>
                <span className="text-right font-medium text-slate-700">{formatCompactDateTime(overwriteTarget.eventEndDate)}</span>
              </div>
            </div>
          </Modal>
        )}
      </AdminPageShell>
    </AuthGuard>
  );
}
