import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  SurveyDetailResponse,
  SurveySectionRecord,
  SurveyQuestionRecord,
  QuestionType,
} from "@soc/contracts";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

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

  const needsOptions = [
    "single_choice",
    "multiple_choice",
    "dropdown",
  ].includes(form.questionType);

  const addOption = () =>
    set("options", [...form.options, { value: "", labelKo: "", labelEn: "" }]);
  const removeOption = (i: number) =>
    set(
      "options",
      form.options.filter((_, idx) => idx !== i),
    );
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
            <label className="block text-xs font-medium text-gray-600 mb-1">
              제목 (국문) *
            </label>
            <input
              className={inputCls}
              value={form.titleKo}
              onChange={(e) => set("titleKo", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              제목 (영문) *
            </label>
            <input
              className={inputCls}
              value={form.titleEn}
              onChange={(e) => set("titleEn", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              설명 (국문)
            </label>
            <textarea
              className={`${inputCls} min-h-[60px] resize-y`}
              value={form.descriptionKo}
              onChange={(e) => set("descriptionKo", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              설명 (영문)
            </label>
            <textarea
              className={`${inputCls} min-h-[60px] resize-y`}
              value={form.descriptionEn}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          </div>
        </div>

        <label className="block text-xs font-medium text-gray-600">
          질문 유형 *
        </label>
        <select
          className={inputCls}
          value={form.questionType}
          onChange={(e) => set("questionType", e.target.value as QuestionType)}
        >
          {QUESTION_TYPES.map((qt) => (
            <option key={qt.value} value={qt.value}>
              {qt.label}
            </option>
          ))}
        </select>

        {needsOptions && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              선택지
            </label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="value"
                  value={opt.value}
                  onChange={(e) => updateOption(i, "value", e.target.value)}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="국문"
                  value={opt.labelKo}
                  onChange={(e) => updateOption(i, "labelKo", e.target.value)}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="영문"
                  value={opt.labelEn}
                  onChange={(e) => updateOption(i, "labelEn", e.target.value)}
                />
                <button
                  onClick={() => removeOption(i)}
                  className="text-red-400 text-sm hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="text-blue-500 text-xs hover:underline"
            >
              + 선택지 추가
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isRequired"
            checked={form.isRequired}
            onChange={(e) => set("isRequired", e.target.checked)}
          />
          <label htmlFor="isRequired" className="text-xs text-gray-600">
            필수 응답
          </label>
        </div>

        {form.questionType === "short_text" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              응답 정규식
            </label>
            <input
              className={inputCls}
              placeholder="선택 사항"
              value={form.answerRegex}
              onChange={(e) => set("answerRegex", e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            응답 마감 시각
          </label>
          <input
            type="datetime-local"
            className={inputCls}
            value={form.editDeadlineAt}
            onChange={(e) => set("editDeadlineAt", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function SurveyEditorPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const isEdit = Boolean(surveyId);

  const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

  // 설문 설정 폼
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionKo, setDescriptionKo] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [feePayersOnly, setFeePayersOnly] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [maxResponses, setMaxResponses] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [connectedPostId, setConnectedPostId] = useState("");

  // 섹션 / 질문
  const [sections, setSections] = useState<
    (SurveySectionRecord & { questions: SurveyQuestionRecord[] })[]
  >([]);

  // 편집 상태
  const [tab, setTab] = useState<"settings" | "content">("settings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);

  // 질문 편집 모달
  const [editingQuestion, setEditingQuestion] = useState<{
    sectionId: string;
    questionId: string | null;
    initial: QuestionFormState;
  } | null>(null);

  // 섹션 추가 중
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  // 드래그 상태
  const dragItem = useRef<{ sectionId: string; index: number } | null>(null);

  useEffect(() => {
    (async () => {
      const session = await getAuthSessionSummary(client);
      if (!hasPersistedProfile(session)) {
        navigate("/login");
        return;
      }

      if (isEdit && surveyId) {
        try {
          const detail: SurveyDetailResponse =
            await client.getSurveyDetail(surveyId);
          setTitleKo(detail.titleKo);
          setTitleEn(detail.titleEn);
          setDescriptionKo(detail.descriptionKo ?? "");
          setDescriptionEn(detail.descriptionEn ?? "");
          setStatus(detail.status);
          setFeePayersOnly(detail.feePayersOnly);
          setAllowAnonymous(detail.allowAnonymous);
          setMaxResponses(
            detail.maxResponses != null ? String(detail.maxResponses) : "",
          );
          setOpensAt(
            detail.opensAt ? isoToHtmlDatetimeLocal(detail.opensAt) : "",
          );
          setClosesAt(
            detail.closesAt ? isoToHtmlDatetimeLocal(detail.closesAt) : "",
          );
          setConnectedPostId(detail.connectedPostId ?? "");
          setSections(detail.sections);
          setLoadedSurveyId(surveyId);
        } catch {
          setError("설문조사를 불러오지 못했습니다.");
        }
      }
    })();
  }, []);

  const handleSaveSettings = async () => {
    if (!titleKo.trim()) {
      setError("국문 제목은 필수입니다.");
      return;
    }
    if (!titleEn.trim()) {
      setError("영문 제목은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        titleKo: titleKo.trim(),
        titleEn: titleEn.trim(),
        descriptionKo: descriptionKo.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        status: status as
          | "draft"
          | "scheduled"
          | "open"
          | "closed"
          | "archived",
        feePayersOnly,
        allowAnonymous,
        maxResponses: maxResponses ? Number(maxResponses) : undefined,
        opensAt: opensAt ? htmlDatetimeLocalToIso(opensAt) : undefined,
        closesAt: closesAt ? htmlDatetimeLocalToIso(closesAt) : undefined,
        connectedPostId: connectedPostId.trim() || undefined,
      };
      if (isEdit && loadedSurveyId) {
        await client.updateSurvey(loadedSurveyId, body);
        alert("저장되었습니다.");
      } else {
        await client.createSurvey(body);
        navigate("/admin/surveys", { replace: true });
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
      editDeadlineAt: form.editDeadlineAt
        ? htmlDatetimeLocalToIso(form.editDeadlineAt)
        : undefined,
      sortOrder: questionId
        ? undefined
        : (section?.questions.length ?? 0),
    };

    try {
      if (questionId) {
        const updated = await client.updateQuestion(
          loadedSurveyId,
          sectionId,
          questionId,
          body,
        );
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  questions: s.questions.map((q) =>
                    q.id === questionId ? updated : q,
                  ),
                }
              : s,
          ),
        );
      } else {
        const created = await client.createQuestion(
          loadedSurveyId,
          sectionId,
          body,
        );
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? { ...s, questions: [...s.questions, created] }
              : s,
          ),
        );
      }
      setEditingQuestion(null);
    } catch {
      alert("질문 저장에 실패했습니다.");
    }
  };

  const handleDeleteQuestion = async (
    sectionId: string,
    questionId: string,
  ) => {
    if (!loadedSurveyId) return;
    if (!confirm("질문을 삭제하시겠습니까?")) return;
    try {
      await client.deleteQuestion(loadedSurveyId, sectionId, questionId);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                questions: s.questions.filter((q) => q.id !== questionId),
              }
            : s,
        ),
      );
    } catch {
      alert("질문 삭제에 실패했습니다.");
    }
  };

  const handleReorderQuestion = async (
    sectionId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (fromIndex === toIndex || !loadedSurveyId) return;

    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const reordered = [...section.questions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // 낙관적 업데이트
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, questions: reordered } : s,
      ),
    );

    try {
      await Promise.all(
        reordered.map((q, idx) =>
          client.updateQuestion(loadedSurveyId, sectionId, q.id, {
            sortOrder: idx,
          }),
        ),
      );
    } catch {
      // 실패 시 원상복구
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, questions: section.questions } : s,
        ),
      );
      alert("순서 변경에 실패했습니다.");
    }
  };

  const openNewQuestion = (sectionId: string) => {
    setEditingQuestion({
      sectionId,
      questionId: null,
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
        options: (q.options ?? []).map((o) => ({
          value: o.value,
          labelKo: o.labelKo,
          labelEn: o.labelEn ?? "",
        })),
        answerRegex: q.answerRegex ?? "",
        isRequired: q.isRequired,
        editDeadlineAt: q.editDeadlineAt
          ? isoToHtmlDatetimeLocal(q.editDeadlineAt)
          : "",
      },
    });
  };

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/admin/surveys")}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← 목록
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? "설문조사 편집" : "새 설문조사"}
          </h1>
        </div>

        {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

        {/* 탭 */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          {(["settings", "content"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "settings" ? "설정" : "문항 구성"}
            </button>
          ))}
        </div>

        {/* ── 설정 탭 ─────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  제목 (국문) *
                </label>
                <input
                  className={inputCls}
                  value={titleKo}
                  onChange={(e) => setTitleKo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  제목 (영문) *
                </label>
                <input
                  className={inputCls}
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  설명 (국문)
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px] resize-y`}
                  value={descriptionKo}
                  onChange={(e) => setDescriptionKo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  설명 (영문)
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px] resize-y`}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  상태
                </label>
                <select
                  className={inputCls}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {SURVEY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  최대 응답 수
                </label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  placeholder="제한 없음"
                  value={maxResponses}
                  onChange={(e) => setMaxResponses(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  시작 시각 (Asia/Seoul)
                </label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  마감 시각 (Asia/Seoul)
                </label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feePayersOnly}
                  onChange={(e) => setFeePayersOnly(e.target.checked)}
                />
                과비 납부자만 응답 가능
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                />
                로그인 없이 응답 가능
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                연결 게시글 ID
              </label>
              <input
                className={inputCls}
                placeholder="선택 사항"
                value={connectedPostId}
                onChange={(e) => setConnectedPostId(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? "저장 중…" : isEdit ? "설정 저장" : "설문 생성"}
              </Button>
            </div>
          </div>
        )}

        {/* ── 문항 구성 탭 ───────────────────────────────────────── */}
        {tab === "content" && (
          <div className="space-y-6">
            {!loadedSurveyId && (
              <p className="text-gray-500 text-sm">
                설정 탭에서 설문을 먼저 저장하세요.
              </p>
            )}

            {loadedSurveyId && (
              <>
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">
                        {section.titleKo}
                      </h3>
                      <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        섹션 삭제
                      </button>
                    </div>

                    {section.questions.length === 0 && (
                      <p className="text-gray-400 text-xs">질문이 없습니다.</p>
                    )}

                    {section.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={() => {
                          dragItem.current = { sectionId: section.id, index: idx };
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragItem.current) return;
                          if (dragItem.current.sectionId !== section.id) return;
                          void handleReorderQuestion(
                            section.id,
                            dragItem.current.index,
                            idx,
                          );
                          dragItem.current = null;
                        }}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm cursor-grab active:cursor-grabbing group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 select-none">
                            ⠿
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-gray-700 truncate">
                              {q.titleKo}
                            </span>
                            <span className="ml-2 text-xs text-gray-400">
                              {
                                QUESTION_TYPES.find(
                                  (t) => t.value === q.questionType,
                                )?.label
                              }
                              {q.isRequired ? " · 필수" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3 flex-shrink-0 ml-2">
                          <button
                            onClick={() => openEditQuestion(section.id, q)}
                            className="text-blue-500 hover:underline text-xs"
                          >
                            편집
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteQuestion(section.id, q.id)
                            }
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => openNewQuestion(section.id)}
                      className="text-blue-500 text-xs hover:underline"
                    >
                      + 질문 추가
                    </button>
                  </div>
                ))}

                {/* 새 섹션 추가 */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="섹션 제목 (국문)"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                  />
                  <Button
                    onClick={handleAddSection}
                    disabled={addingSection || !newSectionTitle.trim()}
                  >
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
  );
}
