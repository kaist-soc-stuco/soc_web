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
import { AdminCard, AdminPageHeader, AdminPageShell } from "@/components/ui/admin-page";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { Permissions } from "@/lib/permissions";
import {
  SurveySettingsForm,
  type SurveySettingsFormValues,
} from "@/components/organisms/survey-settings-form";
import { QuestionEditorModal, QuestionFormState } from "@/components/organisms/question-editor-modal";
import {
  SectionEditorModal,
  type SectionFormState,
} from "@/components/organisms/section-editor-modal";
import { ArrowLeft, Calendar as CalendarIcon, Check, Eye, GripVertical, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRestoredBanner } from "@/components/ui/draft-restored-banner";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";

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

const QUESTION_TYPES = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "dropdown", label: "드롭다운" },
  { value: "grid_single", label: "객관식 그리드" },
  { value: "grid_multiple", label: "체크박스 그리드" },
  { value: "file_upload", label: "파일 업로드" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

const SurveySettingsSchema = z.object({
  titleKo: z.string().min(1, "국문 제목은 필수입니다.").max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionImageUrlKo: z.string().nullable().optional(),
  descriptionImageUrlEn: z.string().nullable().optional(),
  kind: z.enum(["SURVEY", "APPLICATION"]),
  resultVisibility: z.enum(["PRIVATE", "PUBLIC"]),
  feePayersOnly: z.boolean().optional(),
  eligibleSocAffiliations: z.array(z.enum(["PRIMARY"])),
  academicEligibility: z.enum(["ANY", "ENROLLED_ONLY", "ENROLLED_OR_LEAVE"]),
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
  if (!data.isKoreanOnly) {
    if (!data.titleEn?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "영문 제목은 필수입니다 (한국어 사용자만 설정이 아닐 경우).",
        path: ["titleEn"],
      });
    }
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
  isRequired: true,
  config: null,
});

const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const QUESTION_ROW_CLASS =
  "group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm";

type QuestionRowContentProps = {
  question: SurveyQuestionRecord;
  isOngoing: boolean;
  dragHandle: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
};

function QuestionRowContent({
  question,
  isOngoing,
  dragHandle,
  onEdit,
  onDelete,
}: QuestionRowContentProps) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {!isOngoing && dragHandle}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">
            {question.titleKo}
          </span>
          {question.titleEn && (
            <span className="hidden truncate text-xs font-semibold text-kaist-grey/60 md:inline">
              ({question.titleEn})
            </span>
          )}
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[length:var(--ui-text-caption-size)] font-medium text-slate-600">
            {QUESTION_TYPES.find((type) => type.value === question.questionType)?.label}
          </span>
          {question.isRequired && (
            <span className="shrink-0 text-[length:var(--ui-text-micro-size)] font-bold text-red-500">*필수</span>
          )}
        </div>
      </div>
      <div className="ml-2 flex shrink-0 gap-1">
        <IconButton
          size="sm"
          aria-label={`${question.titleKo} ${isOngoing ? "보기" : "편집"}`}
          onClick={onEdit}
        >
          {isOngoing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
        </IconButton>
        {!isOngoing && (
          <IconButton
            size="sm"
            aria-label={`${question.titleKo} 삭제`}
            onClick={onDelete}
            className="text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="size-4" />
          </IconButton>
        )}
      </div>
    </>
  );
}

type SortableQuestionRowProps = {
  question: SurveyQuestionRecord;
  isOngoing: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function SortableQuestionRow({
  question,
  isOngoing,
  onEdit,
  onDelete,
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
      className="flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-kaist-grey/35 transition-colors hover:bg-slate-100 hover:text-kaist-grey/80 active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${QUESTION_ROW_CLASS} transition-[background-color,border-color,box-shadow] duration-100 ${
        isDragging
          ? "relative z-0 opacity-0"
          : "hover:border-slate-300 hover:bg-slate-50/60"
      }`}
    >
      <QuestionRowContent
        question={question}
        isOngoing={isOngoing}
        dragHandle={dragHandle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function QuestionDragOverlayRow({
  question,
  isOngoing,
  onEdit,
  onDelete,
  width,
}: SortableQuestionRowProps & { width: number | null }) {
  return (
    <div
      style={{ width: width ?? undefined }}
      className={`${QUESTION_ROW_CLASS} relative z-50 cursor-grabbing border-brand-primary/45 shadow-lg`}
    >
      <QuestionRowContent
        question={question}
        isOngoing={isOngoing}
        dragHandle={
          <span className="flex size-7 shrink-0 items-center justify-center text-brand-primary">
            <GripVertical className="size-4" />
          </span>
        }
        onEdit={onEdit}
        onDelete={onDelete}
      />
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

  const [sections, setSections] = useState<(SurveySectionRecord & { questions: SurveyQuestionRecord[] })[]>([]);
  const [tab, setTab] = useState<"settings" | "content" | "delivery">("settings");

  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "creating" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionTitleEn, setNewSectionTitleEn] = useState("");
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
  const branchTargetsForEditing = useMemo(() => {
    if (!editingQuestion) return [];
    const currentIndex = sections.findIndex((section) => section.id === editingQuestion.sectionId);
    return sections.slice(currentIndex >= 0 ? currentIndex + 1 : 0).map((section) => ({
      id: section.id,
      titleKo: section.titleKo,
    }));
  }, [editingQuestion, sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
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
            feePayersOnly: detail.feePayersOnly,
            eligibleSocAffiliations: detail.eligibleSocAffiliations ?? [],
            academicEligibility: detail.academicEligibility ?? "ANY",
            allowAnonymous: detail.allowAnonymous ?? false,
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

    return {
      kind: values.kind,
      titleKo: values.titleKo.trim() || (allowPlaceholder ? "제목 없는 설문" : ""),
      titleEn: values.titleEn?.trim() || undefined,
      descriptionKo: values.descriptionKo?.trim() || undefined,
      descriptionEn: values.descriptionEn?.trim() || undefined,
      descriptionImageUrlKo: values.descriptionImageUrlKo ?? null,
      descriptionImageUrlEn: values.descriptionImageUrlEn ?? null,
      feeRequirementPolicy: values.feePayersOnly ? "PAID_ONLY" : "NONE",
      eligibleSocAffiliations: values.eligibleSocAffiliations,
      academicEligibility: values.academicEligibility,
      allowAnonymous: values.allowAnonymous,
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

  const handleTabChange = async (nextTab: "settings" | "content" | "delivery") => {
    if (nextTab === "content" && !loadedSurveyId) {
      try {
        await ensureDraft();
      } catch {
        return;
      }
    }
    setTab(nextTab);
  };

  const handleStartNewSurvey = () => {
    setDraftBannerVisible(false);
    setDraftRestoredAt(null);
    setLoadedSurveyId(null);
    setLoadedLifecycleStatus(null);
    setSections([]);
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
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "섹션 삭제 실패"));
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

  const openNewQuestion = (sectionId: string) => {
    setEditingQuestion({
      sectionId,
      initial: emptyQuestion(),
    });
  };

  const openEditQuestion = (sectionId: string, q: SurveyQuestionRecord) => {
    setEditingQuestion({
      sectionId,
      questionId: q.id,
      initial: {
        titleKo: q.titleKo,
        titleEn: q.titleEn ?? "",
        descriptionKo: q.descriptionKo ?? "",
        descriptionEn: q.descriptionEn ?? "",
        questionType: q.questionType,
        options: (q.options ?? []).map((opt) => ({
          value: opt.value,
          labelKo: opt.labelKo,
          labelEn: opt.labelEn ?? "",
          imageUrlKo: opt.imageUrlKo ?? null,
          imageUrlEn: opt.imageUrlEn ?? null,
        })),
        answerRegex: q.answerRegex ?? "",
        isRequired: q.isRequired ?? true,
        config: q.config,
      },
    });
  };

  const handleSaveQuestion = async (qForm: QuestionFormState) => {
    if (!loadedSurveyId || !editingQuestion) return;
    setError(null);
    const { sectionId, questionId } = editingQuestion;
    const body = {
      titleKo: qForm.titleKo.trim(),
      titleEn: qForm.titleEn.trim() || undefined,
      descriptionKo: qForm.descriptionKo.trim() || undefined,
      descriptionEn: qForm.descriptionEn.trim() || undefined,
      questionType: qForm.questionType,
      options: qForm.options.length > 0 ? qForm.options : undefined,
      config: qForm.config ?? undefined,
      answerRegex: qForm.answerRegex.trim() || undefined,
      isRequired: qForm.isRequired,
    };

    try {
      if (questionId) {
        await client.updateQuestion(loadedSurveyId, sectionId, questionId, body);
      } else {
        await client.createQuestion(loadedSurveyId, sectionId, body);
      }
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
      setEditingQuestion(null);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "문항 저장 실패"));
    }
  };

  const handleDeleteQuestion = async (sectionId: string, questionId: string) => {
    if (!loadedSurveyId) return;
    const question = sections
      .find((section) => section.id === sectionId)
      ?.questions.find((item) => item.id === questionId);
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      title: "문항 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{question?.titleKo || "이 문항"}”</strong> 문항을 삭제하시겠습니까?</>,
      warning: "(삭제된 문항과 응답 데이터는 영구히 복구할 수 없습니다.)",
      tone: "danger",
    });
    if (!confirmed) return;

    setError(null);
    try {
      await client.deleteQuestion(loadedSurveyId, sectionId, questionId);
      const updated = await client.getSurveyDetail(loadedSurveyId);
      setSections(updated.sections);
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
                    className="gap-1.5"
                    onClick={() => window.open(`/survey/${loadedSurveyId}`, "_blank", "noopener,noreferrer")}
                  >
                    <Eye className="size-4" /> 미리보기
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
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
              { value: "settings", label: "기본 정보" },
              { value: "content", label: `문항 구성${sections.length ? ` · ${sections.reduce((count, section) => count + section.questions.length, 0)}` : ""}` },
              { value: "delivery", label: "배포 설정" },
            ]}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl text-sm font-semibold">
              {error}
            </div>
          )}

          {(tab === "settings" || tab === "delivery") && (
            <FormProvider {...form}>
              <SurveySettingsForm
                mode={tab === "settings" ? "basic" : "delivery"}
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
            <AdminCard className="space-y-5 p-5 md:p-6">
              {!loadedSurveyId && (
                <div className="bg-gray-50 border border-kaist-grey/10 p-12 rounded-2xl text-center text-sm font-bold text-kaist-grey/60">
                  설정 탭에서 설문을 먼저 저장해주세요.
                </div>
              )}

                {loadedSurveyId && (
                  <>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleQuestionDragStart}
                      onDragCancel={handleQuestionDragCancel}
                      onDragEnd={handleQuestionDragEnd}
                    >
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                        >
                          {/* 섹션 헤더 (국문/영문 제목 지원) */}
                          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
                            <div className="flex flex-col gap-0.5">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {section.titleKo}
                              </h3>
                              {section.titleEn && (
                                <span className="text-xs font-normal text-slate-500">
                                  {section.titleEn}
                                </span>
                              )}
                            </div>
                            {!isOngoing && (
                              <div className="flex items-center gap-1">
                                <IconButton
                                  size="sm"
                                  aria-label={`${section.titleKo} 섹션 편집`}
                                  onClick={() => openEditSection(section)}
                                >
                                  <Pencil className="size-4" />
                                </IconButton>
                                <IconButton
                                  size="sm"
                                  aria-label={`${section.titleKo} 섹션 삭제`}
                                  onClick={() => handleDeleteSection(section.id)}
                                  className="text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="size-4" />
                                </IconButton>
                              </div>
                            )}
                          </div>

                          {/* 섹션 질문 목록 */}
                          <div className="space-y-2 p-4">
                            {section.questions.length === 0 && (
                              <p className="text-kaist-grey/40 text-sm text-center py-6 font-bold">
                                등록된 질문이 없습니다.
                              </p>
                            )}

                            <SortableContext
                              items={section.questions.map((question) => question.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {section.questions.map((question) => (
                                <SortableQuestionRow
                                  key={question.id}
                                  question={question}
                                  isOngoing={isOngoing}
                                  onEdit={() => openEditQuestion(section.id, question)}
                                  onDelete={() => handleDeleteQuestion(section.id, question.id)}
                                />
                              ))}
                            </SortableContext>
                            {!isOngoing && (
                              <div className="pt-2">
                                <Button variant="ghost"
                                  onClick={() => openNewQuestion(section.id)}
                                  className="inline-flex items-center gap-1.5 border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-brand-primary hover:bg-emerald-50"
                                >
                                  <Plus className="w-4 h-4" />
                                  질문 추가하기
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
                                onEdit={() => undefined}
                                onDelete={() => undefined}
                              />
                            ) : null}
                          </DragOverlay>,
                          document.body,
                        )
                      : null}
                    </DndContext>

                    {/* 새 섹션 추가 영역 */}
                    {!isOngoing && (
                      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 md:flex-row">
                        <UiInput
                          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-kaist-black bg-white border border-kaist-grey/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/30 transition-all placeholder:text-kaist-grey/40"
                          placeholder="새로운 섹션 제목 (국문)"
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                        />
                        <UiInput
                          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-kaist-black bg-white border border-kaist-grey/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/30 transition-all placeholder:text-kaist-grey/40 ${
                             isKoreanOnly ? "opacity-35 cursor-not-allowed bg-gray-100" : ""
                           }`}
                          placeholder="영문 섹션 제목"
                          value={newSectionTitleEn}
                          disabled={isKoreanOnly}
                          onChange={(e) => setNewSectionTitleEn(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                        />
                        <Button variant="ghost"
                          onClick={handleAddSection}
                          disabled={addingSection || !newSectionTitle.trim()}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0"
                        >
                          {addingSection ? "추가 중…" : "섹션 추가"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </AdminCard>
            )}
        </main>

        {editingQuestion && (
          <QuestionEditorModal
            initial={editingQuestion.initial}
            isKoreanOnly={isKoreanOnly}
            isOngoing={isOngoing}
            currentSectionId={editingQuestion.sectionId}
            branchTargets={branchTargetsForEditing}
            onSave={handleSaveQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        )}

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
