import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleListItem,
  SurveyDetailResponse,
  SurveySectionRecord,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { z } from "zod";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { htmlDatetimeLocalToIso, isoToDate, isoToHtmlDatetimeLocal } from "@soc/shared";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { Permissions } from "@/lib/permissions";
import {
  SurveySettingsForm,
  type SurveySettingsFormValues,
} from "@/components/organisms/survey-settings-form";
import { QuestionEditorModal, QuestionFormState } from "@/components/organisms/question-editor-modal";
import { GripVertical, Plus, Calendar as CalendarIcon } from "lucide-react";

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

const QUESTION_TYPES = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "dropdown", label: "드롭다운" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

const SurveySettingsSchema = z.object({
  titleKo: z.string().min(1, "국문 제목은 필수입니다.").max(255),
  titleEn: z.string().max(255).optional(),
  descriptionKo: z.string().optional(),
  descriptionEn: z.string().optional(),
  kind: z.string().min(1).max(20),
  resultVisibility: z.string().min(1).max(20),
  feePayersOnly: z.boolean().optional(),
  isKoreanOnly: z.boolean().optional(),
  allowMultipleResponses: z.boolean().optional(),
  allowResponseEdit: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  showOnCalendar: z.boolean().optional(),
  maxResponseCount: z
    .string()
    .optional()
    .refine((value: string | undefined) => !value || /^[0-9]+$/.test(value), {
      message: "숫자만 입력하세요.",
    }),
  openAt: z.string().min(1, "시작 시각을 입력해주세요."),
  closeAt: z.string().min(1, "마감 시각을 입력해주세요."),
  connectedArticleId: z.string().optional(),
}).refine((data) => {
  if (!data.isKoreanOnly) {
    return !!data.titleEn?.trim();
  }
  return true;
}, {
  message: "영문 제목은 필수입니다 (Korean Speakers Only가 아닐 경우).",
  path: ["titleEn"],
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
  editDeadlineAt: "",
});

const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export function SurveyEditorPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const isEdit = Boolean(surveyId);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const form = useForm<SurveySettingsFormValues>({
    resolver: zodResolver(SurveySettingsSchema),
    defaultValues: {
      titleKo: "",
      titleEn: "",
      descriptionKo: "",
      descriptionEn: "",
      kind: "SURVEY",
      resultVisibility: "PUBLIC",
      feePayersOnly: false,
      isKoreanOnly: false,
      allowMultipleResponses: false,
      allowResponseEdit: false,
      isPublished: false,
      showOnCalendar: false,
      maxResponseCount: "",
      openAt: "",
      closeAt: "",
      connectedArticleId: "",
    },
  });

  const isKoreanOnly = Boolean(form.watch("isKoreanOnly"));
  const isPublished = Boolean(form.watch("isPublished"));
  const isOngoing = isEdit && isPublished;

  const [articleSearchResults, setArticleSearchResults] = useState<ArticleListItem[]>([]);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [selectedArticleTitle, setSelectedArticleTitle] = useState<string | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<{
    articleId: string;
    title: string;
    eventStartDate: string;
    eventEndDate: string;
  } | null>(null);

  const [sections, setSections] = useState<(SurveySectionRecord & { questions: SurveyQuestionRecord[] })[]>([]);
  const [tab, setTab] = useState<"settings" | "content">("settings");

  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionTitleEn, setNewSectionTitleEn] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<{
    sectionId: string;
    questionId?: string;
    initial: QuestionFormState;
  } | null>(null);

  const dragItem = useRef<{ sectionId: string; index: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (sessionLoading) return;
      if (!session?.authenticated) {
        navigate("/login");
        return;
      }
      const userPermission = session.permission ?? 0;
      if (!(userPermission & Permissions.MANAGE_SURVEY)) {
        alert("권한이 없습니다.");
        navigate("/");
        return;
      }

      if (isEdit && surveyId) {
        try {
          const detail: SurveyDetailResponse = await client.getSurveyDetail(surveyId);
          form.reset({
            titleKo: detail.titleKo,
            titleEn: detail.titleEn ?? "",
            descriptionKo: detail.descriptionKo ?? "",
            descriptionEn: detail.descriptionEn ?? "",
            kind: detail.kind ?? "SURVEY",
            resultVisibility: detail.resultVisibility ?? "PUBLIC",
            feePayersOnly: detail.feePayersOnly,
            isKoreanOnly: detail.isKoreanOnly ?? false,
            allowMultipleResponses: detail.allowMultipleResponses ?? false,
            allowResponseEdit: detail.allowResponseEdit ?? false,
            isPublished: detail.isPublished ?? false,
            showOnCalendar: detail.showOnCalendar ?? false,
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
        } catch (err: unknown) {
          console.error(err);
          setError("설문조사를 불러오지 못했습니다.");
        }
      }
    })();
  }, [isEdit, surveyId, navigate, form, session, sessionLoading]);

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
        titleEn: values.titleEn?.trim() || undefined,
        descriptionKo: values.descriptionKo?.trim() || undefined,
        descriptionEn: values.descriptionEn?.trim() || undefined,
        feeRequirementPolicy: values.feePayersOnly ? "PAID_ONLY" : "NONE",
        allowMultipleResponses: values.allowMultipleResponses,
        allowResponseEdit: values.allowMultipleResponses
          ? false
          : values.allowResponseEdit,
        isKoreanOnly: values.isKoreanOnly,
        isPublished: values.isPublished,
        showOnCalendar: values.showOnCalendar,
        resultVisibility: values.resultVisibility,
        maxResponseCount,
        openAt: values.openAt ? htmlDatetimeLocalToIso(values.openAt) : undefined,
        closeAt: values.closeAt ? htmlDatetimeLocalToIso(values.closeAt) : undefined,
        connectedArticleId: values.connectedArticleId?.trim() || undefined,
      };
      if (isEdit && loadedSurveyId) {
        await client.updateSurvey(loadedSurveyId, body);
        navigate("/admin/surveys");
      } else {
        await client.createSurvey(body);
        navigate("/admin/surveys");
      }
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
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
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "섹션 안의 모든 문항이 함께 삭제됩니다.",
      title: "이 섹션을 삭제하시겠습니까?",
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
        })),
        answerRegex: q.answerRegex ?? "",
        isRequired: q.isRequired ?? true,
        editDeadlineAt: q.editDeadlineAt ? isoToHtmlDatetimeLocal(q.editDeadlineAt) : "",
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
      answerRegex: qForm.answerRegex.trim() || undefined,
      isRequired: qForm.isRequired,
      editDeadlineAt: qForm.editDeadlineAt ? htmlDatetimeLocalToIso(qForm.editDeadlineAt) : undefined,
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
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "삭제한 문항은 복구할 수 없습니다.",
      title: "이 문항을 삭제하시겠습니까?",
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

  const handleReorderQuestion = async (sectionId: string, oldIdx: number, newIdx: number) => {
    if (!loadedSurveyId || oldIdx === newIdx) return;
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const list = [...section.questions];
    const [moved] = list.splice(oldIdx, 1);
    list.splice(newIdx, 0, moved);

    const backup = sections;
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, questions: list } : s)),
    );

    try {
      // Update sortOrder of all questions in the section to persist the new order
      await Promise.all(
        list.map((q, idx) =>
          client.updateQuestion(loadedSurveyId, sectionId, q.id, {
            sortOrder: idx,
          })
        )
      );
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "순서 변경 실패"));
      setSections(backup);
    }
  };

  const handleFetchArticles = async () => {
    try {
      const results = await client.searchArticles("", 30);
      setArticleSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectArticle = (articleId: string, title: string) => {
    const selectedArticle = articleSearchResults.find(a => a.articleId === articleId);
    if (
      selectedArticle &&
      selectedArticle.boardCode === "행사" &&
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
      setSelectedArticleTitle(title);
      setShowArticleSearch(false);
    }
  };

  const handleConfirmOverwrite = (yes: boolean) => {
    if (!overwriteTarget) return;
    const { articleId, title, eventStartDate, eventEndDate } = overwriteTarget;

    form.setValue("connectedArticleId", articleId);
    setSelectedArticleTitle(title);
    
    if (yes) {
      form.setValue("openAt", isoToHtmlDatetimeLocal(eventStartDate));
      form.setValue("closeAt", isoToHtmlDatetimeLocal(eventEndDate));
    }
    
    setOverwriteTarget(null);
    setShowArticleSearch(false);
  };

  const handleConnectedArticleChange = () => {
    setSelectedArticleTitle(null);
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-gradient-to-br from-kaist-white via-[#f4f7f1] to-[#edf4ef] text-kaist-black pb-20">
        {ConfirmDialog}
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
          
          {/* Header Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-kaist-darkgreen to-emerald-950 p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 opacity-10 blur-2xl w-72 h-72 rounded-full bg-kaist-lightgreen" />
            <div className="relative z-10">
              <button
                onClick={() => navigate("/admin/surveys")}
                className="text-xs font-bold text-white/80 hover:text-white transition-colors mb-3 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                ← 설문조사 목록으로
              </button>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                {isEdit ? "설문조사 편집" : "새 설문조사 작성"}
              </h1>
              <p className="mt-2 text-white/80 font-medium text-sm md:text-base">
                설문의 기본 정보 설정 및 상세 문항 구성을 수정할 수 있습니다.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-gray-100/80 p-1.5 rounded-2xl w-full max-w-xs border border-kaist-darkgreen/10 shadow-inner">
            <button
              onClick={() => setTab("settings")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                tab === "settings"
                  ? "bg-white text-kaist-darkgreen shadow-md shadow-kaist-grey/10 font-extrabold"
                  : "text-kaist-grey hover:bg-white/50"
              }`}
            >
              설문 설정
            </button>
            <button
              onClick={() => setTab("content")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                tab === "content"
                  ? "bg-white text-kaist-darkgreen shadow-md shadow-kaist-grey/10 font-extrabold"
                  : "text-kaist-grey hover:bg-white/50"
              }`}
            >
              상세 문항
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl text-sm font-semibold">
              {error}
            </div>
          )}

          {tab === "settings" && (
            <FormProvider {...form}>
              <SurveySettingsForm
                saving={saving}
                isEdit={isEdit}
                isOngoing={isOngoing}
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
            <div className="space-y-6 bg-white rounded-3xl border border-kaist-darkgreen/10 p-6 md:p-8 shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
              {!loadedSurveyId && (
                <div className="bg-gray-50 border border-kaist-grey/10 p-12 rounded-2xl text-center text-sm font-bold text-kaist-grey/60">
                  설정 탭에서 설문을 먼저 저장해주세요.
                </div>
              )}

                {loadedSurveyId && (
                  <>
                    <div className="space-y-6">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className="bg-white rounded-2xl border border-kaist-grey/20 overflow-hidden shadow-sm"
                        >
                          {/* 섹션 헤더 (국문/영문 제목 지원) */}
                          <div className="px-6 py-4 border-b border-kaist-grey/10 bg-gray-50/50 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <h3 className="font-bold text-kaist-black text-base">
                                {section.titleKo}
                              </h3>
                              {section.titleEn && (
                                <span className="text-xs font-semibold text-kaist-grey/70">
                                  {section.titleEn}
                                </span>
                              )}
                            </div>
                            {!isOngoing && (
                              <button
                                onClick={() => handleDeleteSection(section.id)}
                                className="text-kaist-grey hover:text-red-500 text-xs font-bold transition-all bg-gray-100 hover:bg-red-50 px-3.5 py-2 rounded-xl border border-transparent hover:border-red-100 cursor-pointer"
                              >
                                섹션 삭제
                              </button>
                            )}
                          </div>

                          {/* 섹션 질문 목록 */}
                          <div className="p-6 space-y-3">
                            {section.questions.length === 0 && (
                              <p className="text-kaist-grey/40 text-sm text-center py-6 font-bold">
                                등록된 질문이 없습니다.
                              </p>
                            )}

                            {section.questions.map((q, idx) => (
                              <div
                                key={q.id}
                                draggable={!isOngoing}
                                onDragStart={() => {
                                  if (isOngoing) return;
                                  dragItem.current = { sectionId: section.id, index: idx };
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (isOngoing) return;
                                  if (!dragItem.current) return;
                                  if (dragItem.current.sectionId !== section.id) return;
                                  void handleReorderQuestion(section.id, dragItem.current.index, idx);
                                  dragItem.current = null;
                                }}
                                className={`flex items-center justify-between rounded-xl border border-kaist-grey/15 bg-white px-5 py-4 text-sm transition-all group ${
                                  isOngoing ? "cursor-default" : "cursor-grab active:cursor-grabbing hover:border-kaist-darkgreen/30 hover:shadow-md"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {!isOngoing && (
                                    <span className="text-kaist-grey/30 group-hover:text-kaist-grey/80 flex-shrink-0 select-none transition-colors">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="font-bold text-kaist-black truncate text-sm">
                                      {q.titleKo}
                                    </span>
                                    {q.titleEn && (
                                      <span className="text-xs text-kaist-grey/60 font-semibold hidden md:inline truncate">
                                        ({q.titleEn})
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-kaist-lightgreen/20 text-kaist-darkgreen shrink-0">
                                      {QUESTION_TYPES.find((t) => t.value === q.questionType)?.label}
                                    </span>
                                    {q.isRequired && (
                                      <span className="text-[10px] font-bold text-red-500 shrink-0">
                                        *필수
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 ml-2">
                                  <button
                                    onClick={() => openEditQuestion(section.id, q)}
                                    className="px-3.5 py-2 text-xs font-bold text-kaist-black bg-gray-100 hover:bg-kaist-lightgreen/20 rounded-xl transition-all cursor-pointer border-0"
                                  >
                                    {isOngoing ? "보기" : "편집"}
                                  </button>
                                  {!isOngoing && (
                                    <button
                                      onClick={() => handleDeleteQuestion(section.id, q.id)}
                                      className="px-3.5 py-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer border-0"
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {!isOngoing && (
                              <div className="pt-2">
                                <button
                                  onClick={() => openNewQuestion(section.id)}
                                  className="inline-flex items-center gap-1.5 text-sm font-bold text-kaist-darkgreen bg-kaist-lightgreen/20 hover:bg-kaist-lightgreen/30 px-4.5 py-2.5 rounded-xl transition-all border border-kaist-darkgreen/10 cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  질문 추가하기
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 새 섹션 추가 영역 */}
                    {!isOngoing && (
                      <div className="flex flex-col md:flex-row gap-3 bg-gray-50 p-4 rounded-2xl border border-kaist-grey/15">
                        <input
                          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-kaist-black bg-white border border-kaist-grey/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/30 transition-all placeholder:text-kaist-grey/40"
                          placeholder="새로운 섹션 제목 (국문)"
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                        />
                        <input
                          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-kaist-black bg-white border border-kaist-grey/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/30 transition-all placeholder:text-kaist-grey/40 ${
                             isKoreanOnly ? "opacity-35 cursor-not-allowed bg-gray-100" : ""
                           }`}
                          placeholder={isKoreanOnly ? "한국어 전용 설문입니다 (English disabled)" : "New Section Title (English)"}
                          value={newSectionTitleEn}
                          disabled={isKoreanOnly}
                          onChange={(e) => setNewSectionTitleEn(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                        />
                        <button
                          onClick={handleAddSection}
                          disabled={addingSection || !newSectionTitle.trim()}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0"
                        >
                          {addingSection ? "추가 중…" : "섹션 추가"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
        </main>

        {editingQuestion && (
          <QuestionEditorModal
            initial={editingQuestion.initial}
            isKoreanOnly={isKoreanOnly}
            isOngoing={isOngoing}
            onSave={handleSaveQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        )}

        {overwriteTarget && (
          <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 select-none">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-500/20 flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200 text-kaist-black">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-kaist-darkgreen animate-bounce">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                일정 정보 덮어쓰기
              </h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                선택한 행사 게시글에 등록된 일정이 있습니다.<br />
                이 일정으로 설문조사의 시작 및 마감 시각을 덮어쓰시겠습니까?
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 text-left text-xs font-bold text-slate-600 flex flex-col gap-2 shadow-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">행사 시작:</span>
                  <span className="text-slate-700">{formatCompactDateTime(overwriteTarget.eventStartDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">행사 마감:</span>
                  <span className="text-slate-700">{formatCompactDateTime(overwriteTarget.eventEndDate)}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmOverwrite(true)}
                  className="flex-1 px-4 py-2.5 bg-kaist-darkgreen text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0"
                >
                  덮어쓰기 (Yes)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmOverwrite(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-750 font-bold rounded-xl text-xs hover:bg-slate-350 transition-all cursor-pointer border-0"
                >
                  유지하기 (No)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
