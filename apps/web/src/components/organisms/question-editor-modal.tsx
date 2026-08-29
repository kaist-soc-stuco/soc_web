import { useEffect, useRef, useState } from "react";
import { Copy, Grid2X2, GripVertical, ImagePlus, Plus, Trash2 } from "lucide-react";
import type { QuestionType, SurveyQuestionConfig } from "@soc/contracts";
import { Button } from "@/components/ui/button";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconButton } from "@/components/ui/icon-button";
import { SurveyImageField } from "@/components/ui/survey-image-field";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "dropdown", label: "드롭다운" },
  { value: "rating", label: "등급" },
  { value: "grid_single", label: "객관식 그리드" },
  { value: "grid_multiple", label: "체크박스 그리드" },
  { value: "file_upload", label: "파일 업로드" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

export interface QuestionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  questionType: QuestionType;
  options: { value: string; labelKo: string; labelEn: string; imageUrlKo?: string | null; imageUrlEn?: string | null }[];
  answerRegex: string;
  answerValidationEnabled: boolean;
  isRequired: boolean;
  config: SurveyQuestionConfig | null;
}

interface QuestionInlineEditorProps {
  initial: QuestionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  currentSectionId?: string;
  branchTargets?: Array<{ id: string; titleKo: string }>;
  isNewQuestion?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSave: (q: QuestionFormState) => void | Promise<void>;
  onCancel: () => void;
}

function CompactImagePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <IconButton
        type="button"
        size="sm"
        aria-label={`${label} ${value ? "변경" : "추가"}`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={value ? "border-brand-primary/25 bg-emerald-50 text-brand-primary" : ""}
      >
        <ImagePlus className="size-4" />
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-elevated">
          <SurveyImageField
            label={label}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

export function QuestionInlineEditor({
  initial,
  isKoreanOnly = false,
  isOngoing = false,
  currentSectionId,
  branchTargets = [],
  isNewQuestion = false,
  onDuplicate,
  onDelete,
  onSave,
  onCancel,
}: QuestionInlineEditorProps) {
  const [form, setForm] = useState<QuestionFormState>({
    ...initial,
    answerValidationEnabled:
      initial.answerValidationEnabled ||
      Boolean(initial.answerRegex.trim() || initial.config?.validationErrorMessage?.trim()),
  });
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const saveRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (isKoreanOnly && activeTab === "en") {
      setActiveTab("ko");
    }
  }, [isKoreanOnly, activeTab]);

  const set = <K extends keyof QuestionFormState>(key: K, val: QuestionFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(form.questionType);
  const supportsBranching = form.questionType === "single_choice" || form.questionType === "dropdown";
  const isGrid = form.questionType === "grid_single" || form.questionType === "grid_multiple";
  const supportsValidation = form.questionType === "short_text" || form.questionType === "long_text";
  const gridConfig = form.config ?? { rows: [], columns: [] };
  const branchMap = form.config?.goToSectionByValue ?? {};

  const updateBranchTarget = (optionValue: string, target: string) => {
    const nextMap = { ...branchMap };
    if (target) {
      nextMap[optionValue] = target;
    } else {
      delete nextMap[optionValue];
    }
    const nextConfig = { ...(form.config ?? {}) };
    if (Object.keys(nextMap).length > 0) {
      nextConfig.goToSectionByValue = nextMap;
    } else {
      delete nextConfig.goToSectionByValue;
    }
    set("config", nextConfig);
  };

  const nextUniqueValue = (
    items: Array<{ value: string }>,
    prefix: string,
  ) => {
    const used = new Set(items.map((item) => item.value));
    let index = 1;
    while (used.has(`${prefix}_${index}`)) index += 1;
    return `${prefix}_${index}`;
  };

  const addOption = () => {
    set("options", [...form.options, { value: nextUniqueValue(form.options, "option"), labelKo: "", labelEn: "", imageUrlKo: null, imageUrlEn: null }]);
  };

  const removeOption = (i: number) => {
    set("options", form.options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, field: "value" | "labelKo" | "labelEn" | "imageUrlKo" | "imageUrlEn", val: string | null) => {
    const next = [...form.options];
    const previousValue = next[i]?.value;
    next[i] = { ...next[i], [field]: val };
    set("options", next);
    if (field === "value" && typeof val === "string" && previousValue && previousValue !== val) {
      const nextMap = { ...(form.config?.goToSectionByValue ?? {}) };
      if (nextMap[previousValue]) {
        nextMap[val] = nextMap[previousValue];
        delete nextMap[previousValue];
        set("config", { ...(form.config ?? {}), goToSectionByValue: nextMap });
      }
    }
  };

  const updateGridOption = (
    kind: "rows" | "columns",
    index: number,
    field: "value" | "labelKo" | "labelEn",
    value: string,
  ) => {
    const next = [...(gridConfig[kind] ?? [])];
    next[index] = { ...next[index], [field]: value };
    set("config", { ...gridConfig, [kind]: next });
  };

  const addGridOption = (kind: "rows" | "columns") => {
    const prefix = kind === "rows" ? "row" : "column";
    const items = gridConfig[kind] ?? [];
    set("config", {
      ...gridConfig,
      [kind]: [...items, { value: nextUniqueValue(items, prefix), labelKo: "", labelEn: "" }],
    });
  };

  const removeGridOption = (kind: "rows" | "columns", index: number) => {
    set("config", {
      ...gridConfig,
      [kind]: (gridConfig[kind] ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const changeQuestionType = (questionType: QuestionType) => {
    set("questionType", questionType);
    let nextConfig = form.config ? { ...form.config } : null;
    let shouldUpdateConfig = false;
    if ((questionType === "grid_single" || questionType === "grid_multiple") && !nextConfig) {
      nextConfig = {
        rows: [
          { value: "row_1", labelKo: "항목 1", labelEn: "Item 1" },
          { value: "row_2", labelKo: "항목 2", labelEn: "Item 2" },
        ],
        columns: [
          { value: "column_1", labelKo: "선택 1", labelEn: "Choice 1" },
          { value: "column_2", labelKo: "선택 2", labelEn: "Choice 2" },
          { value: "column_3", labelKo: "선택 3", labelEn: "Choice 3" },
        ],
      };
      shouldUpdateConfig = true;
    }
    if (questionType === "rating") {
      nextConfig = { ...(nextConfig ?? {}), ratingMax: nextConfig?.ratingMax ?? 5 };
      shouldUpdateConfig = true;
    }
    if (questionType !== "short_text" && questionType !== "long_text") {
      set("answerRegex", "");
      set("answerValidationEnabled", false);
      if (nextConfig?.validationErrorMessage) {
        delete nextConfig.validationErrorMessage;
        shouldUpdateConfig = true;
      }
    }
    if (shouldUpdateConfig) {
      set("config", nextConfig && Object.keys(nextConfig).length > 0 ? nextConfig : null);
    }
  };

  const toggleAnswerValidation = (enabled: boolean) => {
    set("answerValidationEnabled", enabled);
    if (!enabled) {
      set("answerRegex", "");
      if (form.config?.validationErrorMessage) {
        const nextConfig = { ...form.config };
        delete nextConfig.validationErrorMessage;
        set("config", nextConfig);
      }
    }
  };

  const handleSave = () => {
    if (!form.titleKo.trim()) {
      setError("국문 제목은 필수입니다.");
      setActiveTab("ko");
      return;
    }
    if (!isKoreanOnly && !form.titleEn.trim()) {
      setError("영문 제목은 필수입니다.");
      setActiveTab("en");
      return;
    }

    if (needsOptions) {
      if (form.options.length === 0) {
        setError("최소 하나의 선택지가 필요합니다.");
        return;
      }
      for (let i = 0; i < form.options.length; i++) {
        const opt = form.options[i];
        if (!opt.value.trim() || !opt.labelKo.trim()) {
          setError(`선택지 ${i + 1}의 값과 국문 라벨은 필수입니다.`);
          return;
        }
        if (!isKoreanOnly && !opt.labelEn.trim()) {
          setError(`선택지 ${i + 1}의 영문 라벨은 필수입니다.`);
          return;
        }
      }
      const optionValues = form.options.map((option) => option.value.trim());
      if (new Set(optionValues).size !== optionValues.length) {
        setError("선택지 값은 서로 달라야 합니다.");
        return;
      }
    }

    if (isGrid) {
      if (!gridConfig.rows?.length || !gridConfig.columns?.length) {
        setError("그리드는 행과 열을 각각 하나 이상 입력해야 합니다.");
        return;
      }
      if ([...(gridConfig.rows ?? []), ...(gridConfig.columns ?? [])].some((item) => !item.value.trim() || !item.labelKo.trim())) {
        setError("그리드 행·열의 값과 국문 라벨은 모두 입력해야 합니다.");
        return;
      }
      for (const [label, items] of [["행", gridConfig.rows ?? []], ["열", gridConfig.columns ?? []]] as const) {
        const values = items.map((item) => item.value.trim());
        if (new Set(values).size !== values.length) {
          setError(`그리드 ${label} 값은 서로 달라야 합니다.`);
          return;
        }
      }
    }

    if (supportsValidation && form.answerValidationEnabled) {
      if (!form.answerRegex.trim()) {
        setError("응답 검증을 사용하려면 정규식을 입력해주세요.");
        return;
      }
      try {
        new RegExp(form.answerRegex.trim());
      } catch {
        setError("응답 검증 정규식이 올바르지 않습니다.");
        return;
      }
    }

    setError(null);
    if (savingRef.current) return;
    savingRef.current = true;
    void Promise.resolve()
      .then(() => onSave(form))
      .finally(() => {
        savingRef.current = false;
      });
  };

  saveRef.current = handleSave;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && editorRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".ui-select-dropdown-menu")) return;
      if (isOngoing) {
        onCancel();
        return;
      }
      saveRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOngoing, onCancel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector(".ui-select-dropdown-menu")) return;
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";
  const compactInputCls =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";
  return (
    <div
      ref={editorRef}
      className="animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-xl border border-l-4 border-brand-primary/45 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] duration-200 md:p-5"
    >
      <div className="mb-3 flex justify-center text-slate-300" aria-hidden="true">
        <GripVertical className="size-5" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            국문 제목 <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <UiInput
              autoFocus={isNewQuestion}
              className={`${inputCls} min-w-0 flex-1`}
              placeholder="질문을 입력하세요"
              value={form.titleKo}
              disabled={isOngoing}
              onChange={(event) => set("titleKo", event.target.value)}
            />
            <CompactImagePicker
              label="국문 문항 이미지"
              value={form.config?.imageUrlKo}
              onChange={(value) => set("config", { ...(form.config ?? {}), imageUrlKo: value })}
              disabled={isOngoing}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            영문 제목 {!isKoreanOnly ? <span className="text-rose-500">*</span> : <span className="text-slate-400">(선택)</span>}
          </label>
          <div className="flex items-center gap-2">
            <UiInput
              className={`${inputCls} min-w-0 flex-1`}
              placeholder="영문 질문을 입력하세요"
              value={form.titleEn}
              disabled={isOngoing || isKoreanOnly}
              onChange={(event) => set("titleEn", event.target.value)}
            />
            <CompactImagePicker
              label="영문 문항 이미지"
              value={form.config?.imageUrlEn}
              onChange={(value) => set("config", { ...(form.config ?? {}), imageUrlEn: value })}
              disabled={isOngoing || isKoreanOnly}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="min-w-0 text-xs font-medium text-slate-600">
          국문 설명 <span className="font-normal text-slate-400">(선택)</span>
          <UiTextarea
            className="mt-1.5 min-h-16 w-full rounded-lg border-slate-200 px-3 py-2 text-sm font-normal leading-5 text-slate-900 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            placeholder="질문에 대한 설명을 입력하세요"
            value={form.descriptionKo}
            disabled={isOngoing}
            onChange={(event) => set("descriptionKo", event.target.value)}
          />
        </label>
        <label className="min-w-0 text-xs font-medium text-slate-600">
          영문 설명 <span className="font-normal text-slate-400">(선택)</span>
          <UiTextarea
            className="mt-1.5 min-h-16 w-full rounded-lg border-slate-200 px-3 py-2 text-sm font-normal leading-5 text-slate-900 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            placeholder="Add a description (optional)"
            value={form.descriptionEn}
            disabled={isOngoing || isKoreanOnly}
            onChange={(event) => set("descriptionEn", event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-slate-600">질문 유형</span>
        <AdminSelectDropdown
          ariaLabel="질문 유형"
          value={form.questionType}
          options={QUESTION_TYPES}
          onChange={(value) => changeQuestionType(value as QuestionType)}
          disabled={isOngoing}
          className="w-full sm:w-52"
          buttonClassName="!h-10 !text-sm"
        />
      </div>

      {needsOptions ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">선택지</span>
            <div className="flex items-center gap-1">
              <SegmentedControl
                ariaLabel="선택지 언어"
                role="tablist"
                value={activeTab}
                onChange={setActiveTab}
                itemClassName="!h-7 !min-h-7 !px-2.5 !text-xs"
                options={[
                  { value: "ko", label: "국문" },
                  { value: "en", label: "영문", disabled: isKoreanOnly },
                ]}
              />
              {!isOngoing ? (
                <Button type="button" variant="ghost" size="sm" onClick={addOption} className="!h-8 !px-2.5 !text-xs !font-medium text-brand-primary hover:bg-emerald-50">
                  <Plus className="size-3.5" /> 선택지 추가
                </Button>
              ) : null}
            </div>
          </div>
          <div className="scrollbar-hidden max-h-64 space-y-2 overflow-y-auto pr-1">
            {form.options.map((option, index) => (
              <div key={`${option.value}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50/70 px-2 py-1.5">
                <span className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 bg-white text-[length:var(--ui-text-micro-size)] text-slate-400 ${form.questionType === "single_choice" || form.questionType === "dropdown" ? "rounded-full" : "rounded"}`} aria-hidden="true">
                  {form.questionType === "multiple_choice" ? "✓" : ""}
                </span>
                <UiInput
                  className={`${compactInputCls} min-w-[12rem] flex-1`}
                  placeholder={activeTab === "ko" ? "선택지 라벨" : "영문 선택지 라벨"}
                  aria-label={`${index + 1}번 ${activeTab === "ko" ? "국문 라벨" : "영문 라벨"}`}
                  value={activeTab === "ko" ? option.labelKo : option.labelEn}
                  disabled={isOngoing || (activeTab === "en" && isKoreanOnly)}
                  onChange={(event) => updateOption(index, activeTab === "ko" ? "labelKo" : "labelEn", event.target.value)}
                />
                <UiInput
                  className={`${compactInputCls} w-28 shrink-0`}
                  placeholder="값"
                  aria-label={`${index + 1}번 내부 값`}
                  value={option.value}
                  disabled={isOngoing}
                  onChange={(event) => updateOption(index, "value", event.target.value)}
                />
                {supportsBranching && branchTargets.length > 0 ? (
                  <AdminSelectDropdown
                    ariaLabel={`${option.labelKo || option.value || "선택지"} 다음 섹션`}
                    className="w-full shrink-0 sm:w-40"
                    value={branchMap[option.value] ?? ""}
                    disabled={isOngoing || !option.value.trim()}
                    onChange={(target) => updateBranchTarget(option.value, target)}
                    options={[
                      { value: "", label: "다음 섹션" },
                      ...branchTargets
                        .filter((target) => target.id !== currentSectionId)
                        .map((target) => ({ value: target.id, label: target.titleKo })),
                      { value: "SUBMIT", label: "여기서 제출 완료" },
                    ]}
                  />
                ) : null}
                <CompactImagePicker
                  label="선택지 이미지"
                  value={activeTab === "ko" ? option.imageUrlKo : option.imageUrlEn}
                  onChange={(value) => updateOption(index, activeTab === "ko" ? "imageUrlKo" : "imageUrlEn", value)}
                  disabled={isOngoing || (activeTab === "en" && isKoreanOnly)}
                />
                {!isOngoing ? (
                  <IconButton
                    type="button"
                    aria-label={`${option.labelKo || option.value || "선택지"} 삭제`}
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isGrid ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Grid2X2 className="size-4 text-brand-primary" />
              <h4 className="text-xs font-semibold text-slate-700">그리드 구성</h4>
            </div>
            <SegmentedControl
              ariaLabel="그리드 언어"
              role="tablist"
              value={activeTab}
              onChange={setActiveTab}
              itemClassName="!h-7 !min-h-7 !px-2.5 !text-xs"
              options={[
                { value: "ko", label: "국문" },
                { value: "en", label: "영문", disabled: isKoreanOnly },
              ]}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["rows", "columns"] as const).map((kind) => (
              <div key={kind} className="min-w-0 rounded-lg bg-slate-50/70 p-2.5">
                <div className="mb-2 text-xs font-medium text-slate-600">
                  {kind === "rows" ? "행(질문 항목)" : "열(선택 척도)"}
                </div>
                <div className="space-y-2">
                  {(gridConfig[kind] ?? []).map((option, index) => (
                    <div key={`${kind}-${index}`} className="flex items-center gap-2">
                      <UiInput
                        className={`${compactInputCls} w-24 shrink-0`}
                        placeholder="값"
                        aria-label={`${kind === "rows" ? "행" : "열"} ${index + 1} 내부 값`}
                        value={option.value}
                        disabled={isOngoing}
                        onChange={(event) => updateGridOption(kind, index, "value", event.target.value)}
                      />
                      <UiInput
                        className={`${compactInputCls} min-w-0 flex-1`}
                        placeholder={activeTab === "ko" ? "라벨" : "Label"}
                        aria-label={`${kind === "rows" ? "행" : "열"} ${index + 1} 라벨`}
                        value={activeTab === "ko" ? option.labelKo : option.labelEn}
                        disabled={isOngoing || (activeTab === "en" && isKoreanOnly)}
                        onChange={(event) => updateGridOption(kind, index, activeTab === "ko" ? "labelKo" : "labelEn", event.target.value)}
                      />
                      {!isOngoing ? (
                        <IconButton
                          type="button"
                          aria-label={`${kind === "rows" ? "행" : "열"} ${index + 1} 삭제`}
                          size="sm"
                          onClick={() => removeGridOption(kind, index)}
                          className="text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      ) : null}
                    </div>
                  ))}
                </div>
                {!isOngoing ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => addGridOption(kind)} className="mt-2 !h-8 !px-2.5 !text-xs !font-medium text-brand-primary hover:bg-emerald-50">
                    <Plus className="size-3.5" /> {kind === "rows" ? "행 추가" : "열 추가"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {form.questionType === "rating" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-600">등급 개수</span>
          <AdminSelectDropdown
            ariaLabel="등급 개수"
            value={String(form.config?.ratingMax ?? 5)}
            options={Array.from({ length: 8 }, (_, index) => ({
              value: String(index + 3),
              label: `${index + 3}개`,
            }))}
            onChange={(value) => set("config", { ...(form.config ?? {}), ratingMax: Number(value) })}
            disabled={isOngoing}
            className="w-24"
            buttonClassName="!h-9 !text-sm"
          />
          <span className="text-xs font-normal text-slate-400">별 아이콘으로 표시됩니다.</span>
        </div>
      ) : null}

      {supportsValidation ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">응답 검증(정규식)</p>
              <p className="mt-0.5 text-xs text-slate-400">입력값이 정규식과 일치하는지 확인합니다.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.answerValidationEnabled}
              aria-label="응답 검증(정규식)"
              disabled={isOngoing}
              onClick={() => toggleAnswerValidation(!form.answerValidationEnabled)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25 disabled:cursor-not-allowed disabled:opacity-50 ${form.answerValidationEnabled ? "bg-brand-primary" : "bg-slate-200"}`}
            >
              <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.answerValidationEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${form.answerValidationEnabled ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  정규식
                  <UiInput
                    className={`${compactInputCls} mt-1.5 w-full`}
                    placeholder="예: ^[0-9]+$"
                    value={form.answerRegex}
                    disabled={isOngoing}
                    onChange={(event) => set("answerRegex", event.target.value)}
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  오류 메시지
                  <UiInput
                    className={`${compactInputCls} mt-1.5 w-full`}
                    placeholder="입력 형식을 확인해 주세요."
                    value={form.config?.validationErrorMessage ?? ""}
                    disabled={isOngoing}
                    onChange={(event) => set("config", { ...(form.config ?? {}), validationErrorMessage: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1">
          {!isNewQuestion && !isOngoing && onDuplicate ? (
            <IconButton type="button" size="sm" aria-label="문항 복제" onClick={onDuplicate}>
              <Copy className="size-4" />
            </IconButton>
          ) : null}
          {!isNewQuestion && !isOngoing && onDelete ? (
            <IconButton type="button" size="sm" aria-label="문항 삭제" onClick={onDelete} className="text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600">
              <Trash2 className="size-4" />
            </IconButton>
          ) : null}
          <span className="ml-1 text-xs text-slate-400">
            {isOngoing ? "읽기 전용 문항" : isNewQuestion ? "바깥 영역을 클릭하면 문항이 등록됩니다." : "바깥 영역을 클릭하면 변경사항이 저장됩니다."}
          </span>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <UiInput
            type="checkbox"
            className="peer sr-only"
            checked={form.isRequired}
            disabled={isOngoing}
            onChange={(event) => set("isRequired", event.target.checked)}
          />
          <span className="relative h-5 w-9 rounded-full bg-slate-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/25 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-brand-primary peer-checked:after:translate-x-4" />
          필수 응답
        </label>
      </div>
    </div>
  );
}
