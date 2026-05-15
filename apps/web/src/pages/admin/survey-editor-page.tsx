import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  SurveyDetailResponse,
  SurveySectionRecord,
  SurveyQuestionRecord,
  QuestionType,
} from "@soc/contracts";
import { z } from "zod";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal } from "@soc/shared";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { Permissions } from "@/lib/permissions";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "dropdown", label: "드롭다운" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

const SURVEY_STATUSES = [
  { value: "draft", label: "초안" },
  { value: "scheduled", label: "예약됨" },
  { value: "open", label: "진행 중" },
  { value: "closed", label: "마감" },
  { value: "archived", label: "보관됨" },
];

const SURVEY_KINDS = [
  { value: "SURVEY", label: "일반 설문" },
  { value: "VOTE", label: "투표" },
  { value: "APPLICATION", label: "신청서/행사 접수" },
];

const SURVEY_VISIBILITIES = [
  { value: "PUBLIC", label: "공개 (전체 공개)" },
  { value: "PRIVATE", label: "비공개 (결과 숨김)" },
];

const SurveySettingsSchema = z.object({
  titleKo: z.string().min(1, "국문 제목은 필수입니다.").max(255),
  titleEn: z.string().min(1, "영문 제목은 필수입니다.").max(255),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  status: z.string().max(20).optional(),
  kind: z.string().min(1).max(20),
  resultVisibility: z.string().min(1).max(20),
  feePayersOnly: z.boolean().optional(),
  allowGuestResponse: z.boolean().optional(),
  maxResponseCount: z
    .string()
    .optional()
    .refine((value: string | undefined) => !value || /^[0-9]+$/.test(value), {
      message: "숫자만 입력하세요.",
    }),
  openAt: z.string().min(1, "시작 시각을 입력해주세요."),
  closeAt: z.string().min(1, "마감 시각을 입력해주세요."),
  connectedArticleId: z.string().optional(),
});

type SurveySettingsFormValues = z.infer<typeof SurveySettingsSchema>;

interface QuestionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  questionType: QuestionType;
  options: { value: string; labelKo: string; labelEn: string }[];
  answerRegex: string;
  isRequired: boolean;
  editDeadlineAt: string;
}

const emptyQuestion = (): QuestionFormState => ({
  titleKo: "",
  titleEn: "",
  descriptionKo: "",
  descriptionEn: "",
  questionType: "short_text",
  options: [],
  answerRegex: "",
  isRequired: true,
  editDeadlineAt: "",
});

// ─── 질문 편집 모달 ───────────────────────────────────────────────────────────

interface QuestionEditorProps {
  initial: QuestionFormState;
  onSave: (q: QuestionFormState) => void;
  onCancel: () => void;
}

function QuestionEditor({ initial, onSave, onCancel }: QuestionEditorProps) {
  const [form, setForm] = useState<QuestionFormState>(initial);

  const set = <K extends keyof QuestionFormState>(
    key: K,
    val: QuestionFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: val }));

  const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(form.questionType);

  const addOption = () => {
    set("options", [...form.options, { value: "", labelKo: "", labelEn: "" }]);
  };

  const removeOption = (i: number) => {
    set("options", form.options.filter((_, idx) => idx !== i));
  };

  const updateOption = (
    i: number,
    field: "value" | "labelKo" | "labelEn",
    val: string,
  ) => {
    const next = [...form.options];
    next[i] = { ...next[i], [field]: val };
    set("options", next);
  };

  const handleSave = () => {
    if (!form.titleKo.trim()) {
      alert("국문 제목은 필수입니다.");
      return;
    }
    if (!form.titleEn.trim()) {
      alert("영문 제목은 필수입니다.");
      return;
    }
    onSave(form);
  };

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">질문 편집</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">제목 (국문) *</label>
            <input className={inputCls} value={form.titleKo} onChange={(e) => set("titleKo", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">제목 (영문) *</label>
            <input className={inputCls} value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">설명 (국문)</label>
            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={form.descriptionKo} onChange={(e) => set("descriptionKo", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">설명 (영문)</label>
            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} />
          </div>
        </div>

        <label className="block text-xs font-medium text-gray-600 mb-1">질문 유형 *</label>
        <select
          className={inputCls}
          value={form.questionType}
          onChange={(e) => set("questionType", e.target.value as QuestionType)}
        >
          {QUESTION_TYPES.map((qt) => (
            <option key={qt.value} value={qt.value}>{qt.label}</option>
          ))}
        </select>

        {needsOptions && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">선택지</label>
            <div className="space-y-2 mb-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={`${inputCls} flex-1`} placeholder="value" value={opt.value} onChange={(e) => updateOption(i, "value", e.target.value)} />
                  <input className={`${inputCls} flex-1`} placeholder="국문" value={opt.labelKo} onChange={(e) => updateOption(i, "labelKo", e.target.value)} />
                  <input className={`${inputCls} flex-1`} placeholder="영문" value={opt.labelEn} onChange={(e) => updateOption(i, "labelEn", e.target.value)} />
                  <button onClick={() => removeOption(i)} className="text-red-400 text-sm hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addOption} className="text-blue-500 text-xs hover:underline">+ 선택지 추가</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="isRequired" checked={form.isRequired} onChange={(e) => set("isRequired", e.target.checked)} />
          <label htmlFor="isRequired" className="text-xs text-gray-600">필수 응답</label>
        </div>

        {form.questionType === "short_text" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">응답 정규식</label>
            <input className={inputCls} placeholder="선택 사항" value={form.answerRegex} onChange={(e) => set("answerRegex", e.target.value)} />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">응답 마감 시각</label>
          <input type="datetime-local" className={inputCls} value={form.editDeadlineAt} onChange={(e) => set("editDeadlineAt", e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </div>
  );
}

interface SurveySettingsFormProps {
  saving: boolean;
  isEdit: boolean;
  showArticleSearch: boolean;
  articleSearchResults: any[];
  selectedArticleTitle: string | null;
  onToggleArticleSearch: () => void;
  onFetchArticles: () => Promise<void>;
  onSelectArticle: (articleId: string, title: string) => void;
  onConnectedArticleChange: () => void;
  onSubmit: (values: SurveySettingsFormValues) => void;
}

function SurveySettingsForm({
  saving,
  isEdit,
  showArticleSearch,
  articleSearchResults,
  selectedArticleTitle,
  onToggleArticleSearch,
  onFetchArticles,
  onSelectArticle,
  onConnectedArticleChange,
  onSubmit,
}: SurveySettingsFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SurveySettingsFormValues>();

  const feePayersOnly = Boolean(watch("feePayersOnly"));
  const allowGuestResponse = Boolean(watch("allowGuestResponse"));
  const connectedArticleId = watch("connectedArticleId") ?? "";

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <form
      className="space-y-4 bg-white rounded-xl border border-gray-200 p-6"
      onSubmit={handleSubmit(onSubmit, () => {})}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">제목 (국문) *</label>
          <input className={inputCls} {...register("titleKo")} />
          {errors.titleKo && (
            <p className="mt-1 text-xs text-red-500">{errors.titleKo.message}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">제목 (영문) *</label>
          <input className={inputCls} {...register("titleEn")} />
          {errors.titleEn && (
            <p className="mt-1 text-xs text-red-500">{errors.titleEn.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">설명 (국문)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} {...register("descriptionKo")} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">설명 (영문)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} {...register("descriptionEn")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">유형 *</label>
          <select className={inputCls} {...register("kind")}>
            {SURVEY_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">결과 공개 범위 *</label>
          <select className={inputCls} {...register("resultVisibility")}>
            {SURVEY_VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">상태</label>
          <select className={inputCls} {...register("status")}>
            {SURVEY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">최대 응답 수</label>
          <input
            type="number"
            className={inputCls}
            placeholder="제한 없음"
            {...register("maxResponseCount")}
          />
          {errors.maxResponseCount && (
            <p className="mt-1 text-xs text-red-500">{errors.maxResponseCount.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">시작 시각 (Asia/Seoul)</label>
          <input type="datetime-local" className={inputCls} {...register("openAt")} />
          {errors.openAt && (
            <p className="mt-1 text-xs text-red-500">{errors.openAt.message}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">마감 시각 (Asia/Seoul)</label>
          <input type="datetime-local" className={inputCls} {...register("closeAt")} />
          {errors.closeAt && (
            <p className="mt-1 text-xs text-red-500">{errors.closeAt.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register("feePayersOnly")} />
          과비 납부자만 응답 가능
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register("allowGuestResponse")} />
          로그인 없이 응답 가능
        </label>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">연결 게시글</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className={inputCls}
              placeholder="게시글 ID 또는 제목 검색"
              value={connectedArticleId}
              onChange={(event) => {
                setValue("connectedArticleId", event.target.value);
                onConnectedArticleChange();
              }}
            />
            {selectedArticleTitle && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 font-medium">
                {selectedArticleTitle}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            type="button"
            onClick={async () => {
              await onFetchArticles();
              onToggleArticleSearch();
            }}
          >
            {showArticleSearch ? "목록 닫기" : "게시글 목록"}
          </Button>
        </div>
        <div className="relative">
          {showArticleSearch && (
            <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-60 overflow-y-auto z-20 absolute w-full top-0">
              <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">최근 게시글 (최대 30개)</span>
                <button onClick={onToggleArticleSearch} className="text-gray-400 hover:text-gray-600 text-xs">닫기</button>
              </div>
              {articleSearchResults.length === 0 && (
                <p className="p-3 text-xs text-gray-400 text-center">불러온 게시글이 없습니다.</p>
              )}
              {articleSearchResults.map((art) => (
                <button
                  key={art.articleId}
                  type="button"
                  onClick={() => onSelectArticle(String(art.articleId), art.titleKo)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                >
                  <span className="font-semibold text-gray-400 mr-2">#{art.articleId}</span>
                  <span className="text-gray-700">{art.titleKo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 에러 요약 박스 (Refined Error Summary) */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-800 mb-1">입력 내용을 확인해주세요</h4>
              <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                {Object.entries(errors).map(([key, error]) => (
                  <li key={key}>{error?.message as string}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중…" : isEdit ? "설정 저장" : "설문 생성"}
        </Button>
      </div>
    </form>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

export function SurveyEditorPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const isEdit = Boolean(surveyId);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();

  const form = useForm<SurveySettingsFormValues>({
    resolver: zodResolver(SurveySettingsSchema),
    defaultValues: {
      titleKo: "",
      titleEn: "",
      descriptionKo: "",
      descriptionEn: "",
      status: "draft",
      kind: "SURVEY",
      resultVisibility: "PUBLIC",
      feePayersOnly: false,
      allowGuestResponse: false,
      maxResponseCount: "",
      openAt: "",
      closeAt: "",
      connectedArticleId: "",
    },
  });

  const [articleSearchResults, setArticleSearchResults] = useState<any[]>([]);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [selectedArticleTitle, setSelectedArticleTitle] = useState<string | null>(null);

  const [sections, setSections] = useState<(SurveySectionRecord & { questions: SurveyQuestionRecord[] })[]>([]);
  const [tab, setTab] = useState<"settings" | "content">("settings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);

  const [editingQuestion, setEditingQuestion] = useState<{
    sectionId: string;
    questionId: string | null;
    initial: QuestionFormState;
  } | null>(null);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  const dragItem = useRef<{ sectionId: string; index: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (sessionLoading || !session) {
        return;
      }

      if (!Permissions.has(session.permission ?? 0, Permissions.MANAGE_SURVEY)) {
        return;
      }

      if (isEdit && surveyId) {
        try {
          const detail: SurveyDetailResponse = await client.getSurveyDetail(surveyId);
          form.reset({
            titleKo: detail.titleKo,
            titleEn: detail.titleEn,
            descriptionKo: detail.descriptionKo ?? "",
            descriptionEn: detail.descriptionEn ?? "",
            status: detail.status,
            kind: form.getValues("kind"),
            resultVisibility: form.getValues("resultVisibility"),
            feePayersOnly: detail.feePayersOnly,
            allowGuestResponse: detail.allowAnonymous,
            maxResponseCount:
              detail.maxResponses != null ? String(detail.maxResponses) : "",
            openAt: detail.opensAt ? isoToHtmlDatetimeLocal(detail.opensAt) : "",
            closeAt: detail.closesAt ? isoToHtmlDatetimeLocal(detail.closesAt) : "",
            connectedArticleId: detail.connectedPostId ?? "",
          });
          setSections(detail.sections);
          setLoadedSurveyId(surveyId);

          if (detail.connectedPostId) {
            client.searchArticles(detail.connectedPostId, 1).then(results => {
              const matched = results.find(r => r.articleId === detail.connectedPostId);
              if (matched) setSelectedArticleTitle(matched.titleKo);
            });
          }
        } catch {
          setError("설문조사를 불러오지 못했습니다.");
        }
      }
    })();
  }, [isEdit, surveyId, client, navigate, form, session, sessionLoading]);

  const handleSaveSettings = async (values: SurveySettingsFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const maxResponseCount = values.maxResponseCount?.trim()
        ? Number(values.maxResponseCount)
        : undefined;
      const body = {
        kind: values.kind,
        titleKo: values.titleKo.trim(),
        titleEn: values.titleEn.trim(),
        descriptionKo: values.descriptionKo?.trim() || undefined,
        descriptionEn: values.descriptionEn?.trim() || undefined,
        status: values.status as any,
        feeRequirementPolicy: values.feePayersOnly ? "PAID_ONLY" : "NONE",
        allowGuestResponse: values.allowGuestResponse,
        resultVisibility: values.resultVisibility,
        maxResponseCount,
        openAt: values.openAt ? htmlDatetimeLocalToIso(values.openAt) : undefined,
        closeAt: values.closeAt ? htmlDatetimeLocalToIso(values.closeAt) : undefined,
        connectedArticleId: values.connectedArticleId?.trim() || undefined,
      };
      if (isEdit && loadedSurveyId) {
        await client.updateSurvey(loadedSurveyId, body);
        alert("저장되었습니다.");
        navigate("/admin/surveys");
      } else {
        await client.createSurvey(body);
        alert("설문이 생성되었습니다.");
        navigate("/admin/surveys");
      }
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = async () => {
    if (!loadedSurveyId) {
      alert("설문 설정을 먼저 저장해주세요.");
      return;
    }
    if (!newSectionTitle.trim()) return;
    setAddingSection(true);
    try {
      const section = await client.createSection(loadedSurveyId, {
        titleKo: newSectionTitle.trim(),
        sortOrder: sections.length,
      });
      setSections((prev) => [...prev, { ...section, questions: [] }]);
      setNewSectionTitle("");
    } catch {
      alert("섹션 추가에 실패했습니다.");
    } finally {
      setAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!loadedSurveyId) return;
    if (!confirm("섹션을 삭제하면 안에 있는 질문도 모두 삭제됩니다.")) return;
    try {
      await client.deleteSection(loadedSurveyId, sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    } catch {
      alert("섹션 삭제에 실패했습니다.");
    }
  };

  const handleSaveQuestion = async (form: QuestionFormState) => {
    if (!loadedSurveyId || !editingQuestion) return;
    const { sectionId, questionId } = editingQuestion;
    const section = sections.find((s) => s.id === sectionId);
    const body = {
      titleKo: form.titleKo,
      titleEn: form.titleEn || undefined,
      descriptionKo: form.descriptionKo || undefined,
      descriptionEn: form.descriptionEn || undefined,
      questionType: form.questionType,
      options: form.options.length > 0 ? form.options : undefined,
      answerRegex: form.answerRegex || undefined,
      isRequired: form.isRequired,
      editDeadlineAt: form.editDeadlineAt ? htmlDatetimeLocalToIso(form.editDeadlineAt) : undefined,
      sortOrder: questionId ? undefined : (section?.questions.length ?? 0),
    };

    try {
      if (questionId) {
        const updated = await client.updateQuestion(loadedSurveyId, sectionId, questionId, body);
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId ? { ...s, questions: s.questions.map((q) => (q.id === questionId ? updated : q)) } : s,
          ),
        );
      } else {
        const created = await client.createQuestion(loadedSurveyId, sectionId, body);
        setSections((prev) =>
          prev.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, created] } : s)),
        );
      }
      setEditingQuestion(null);
    } catch {
      alert("질문 저장에 실패했습니다.");
    }
  };

  const handleDeleteQuestion = async (sectionId: string, questionId: string) => {
    if (!loadedSurveyId) return;
    if (!confirm("질문을 삭제하시겠습니까?")) return;
    try {
      await client.deleteQuestion(loadedSurveyId, sectionId, questionId);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
        ),
      );
    } catch {
      alert("질문 삭제에 실패했습니다.");
    }
  };

  const handleReorderQuestion = async (sectionId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !loadedSurveyId) return;
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const reordered = [...section.questions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, questions: reordered } : s)));

    try {
      await Promise.all(
        reordered.map((q, idx) => client.updateQuestion(loadedSurveyId, sectionId, q.id, { sortOrder: idx })),
      );
    } catch {
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, questions: section.questions } : s)));
      alert("순서 변경에 실패했습니다.");
    }
  };

  const openNewQuestion = (sectionId: string) => {
    setEditingQuestion({ sectionId, questionId: null, initial: emptyQuestion() });
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
        options: (q.options ?? []).map((o) => ({ value: o.value, labelKo: o.labelKo, labelEn: o.labelEn ?? "" })),
        answerRegex: q.answerRegex ?? "",
        isRequired: q.isRequired,
        editDeadlineAt: q.editDeadlineAt ? isoToHtmlDatetimeLocal(q.editDeadlineAt) : "",
      },
    });
  };

  const handleFetchArticles = async () => {
    const results = await client.searchArticles(undefined, 30);
    setArticleSearchResults(results);
  };

  const handleSelectArticle = (articleId: string, title: string) => {
    form.setValue("connectedArticleId", articleId);
    setSelectedArticleTitle(title);
    setShowArticleSearch(false);
  };

  const handleConnectedArticleChange = () => {
    setSelectedArticleTitle(null);
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/admin/surveys")} className="text-sm text-gray-400 hover:text-gray-600">
              ← 목록
            </button>
            <h1 className="text-xl font-bold text-gray-900">{isEdit ? "설문조사 편집" : "새 설문조사"}</h1>
          </div>

          {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

          <div className="flex gap-4 border-b border-gray-200 mb-6">
            {(["settings", "content"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t === "settings" ? "설정" : "문항 구성"}
              </button>
            ))}
          </div>

          {tab === "settings" && (
            <FormProvider {...form}>
              <SurveySettingsForm
                saving={saving}
                isEdit={isEdit}
                showArticleSearch={showArticleSearch}
                articleSearchResults={articleSearchResults}
                selectedArticleTitle={selectedArticleTitle}
                onToggleArticleSearch={() => setShowArticleSearch((prev) => !prev)}
                onFetchArticles={handleFetchArticles}
                onSelectArticle={handleSelectArticle}
                onConnectedArticleChange={handleConnectedArticleChange}
                onSubmit={handleSaveSettings}
              />
            </FormProvider>
          )}

          {tab === "content" && (
            <div className="space-y-6">
              {!loadedSurveyId && <p className="text-gray-500 text-sm">설정 탭에서 설문을 먼저 저장하세요.</p>}

              {loadedSurveyId && (
                <>
                  {sections.map((section) => (
                    <div key={section.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">{section.titleKo}</h3>
                        <button onClick={() => handleDeleteSection(section.id)} className="text-red-400 hover:text-red-600 text-xs">섹션 삭제</button>
                      </div>

                      {section.questions.length === 0 && <p className="text-gray-400 text-xs">질문이 없습니다.</p>}

                      {section.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          draggable
                          onDragStart={() => { dragItem.current = { sectionId: section.id, index: idx }; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!dragItem.current) return;
                            if (dragItem.current.sectionId !== section.id) return;
                            void handleReorderQuestion(section.id, dragItem.current.index, idx);
                            dragItem.current = null;
                          }}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 select-none">⠿</span>
                            <div className="min-w-0">
                              <span className="font-medium text-gray-700 truncate">{q.titleKo}</span>
                              <span className="ml-2 text-xs text-gray-400">
                                {QUESTION_TYPES.find((t) => t.value === q.questionType)?.label}
                                {q.isRequired ? " · 필수" : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-3 flex-shrink-0 ml-2">
                            <button onClick={() => openEditQuestion(section.id, q)} className="text-blue-500 hover:underline text-xs">편집</button>
                            <button onClick={() => handleDeleteQuestion(section.id, q.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openNewQuestion(section.id)} className="text-blue-500 text-xs hover:underline">+ 질문 추가</button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="섹션 제목 (국문)"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                    />
                    <Button onClick={handleAddSection} disabled={addingSection || !newSectionTitle.trim()}>
                      {addingSection ? "추가 중…" : "섹션 추가"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        {editingQuestion && (
          <QuestionEditor
            initial={editingQuestion.initial}
            onSave={handleSaveQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        )}
      </div>
    </AuthGuard>
  );
}