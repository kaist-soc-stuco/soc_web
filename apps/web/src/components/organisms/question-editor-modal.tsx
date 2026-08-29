import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Copy, ImagePlus, Trash2 } from "lucide-react";
import type { QuestionType, SurveyQuestionConfig } from "@soc/contracts";
import { Button } from "@/components/ui/button";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { SurveyImageField } from "@/components/ui/survey-image-field";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "객관식" },
  { value: "multiple_choice", label: "체크박스" },
  { value: "dropdown", label: "드롭다운" },
  { value: "rating", label: "등급" },
  { value: "grid_single", label: "객관식 그리드" },
  { value: "grid_multiple", label: "체크박스 그리드" },
  { value: "file_upload", label: "파일 업로드" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

const isGridQuestionType = (questionType: QuestionType) =>
  questionType === "grid_single" || questionType === "grid_multiple";

const createDefaultGridOption = (kind: "rows" | "columns", index: number) => {
  const isRow = kind === "rows";
  const prefix = isRow ? "row" : "col";
  const koreanPrefix = isRow ? "행" : "열";

  return {
    value: `${prefix}_${index}`,
    labelKo: `${koreanPrefix}${index}`,
    labelEn: `${prefix}${index}`,
  };
};

const createDefaultGridConfig = () => ({
  rows: [createDefaultGridOption("rows", 1), createDefaultGridOption("rows", 2)],
  columns: [
    createDefaultGridOption("columns", 1),
    createDefaultGridOption("columns", 2),
  ],
});

const normalizeGridOptions = (
  kind: "rows" | "columns",
  items: NonNullable<SurveyQuestionConfig["rows"]>,
) => {
  const defaults = createDefaultGridConfig()[kind];
  const usedValues = new Set<string>();
  const prefix = kind === "rows" ? "row" : "col";

  return items.map((item, index) => {
    const defaultItem = defaults[index] ?? createDefaultGridOption(kind, index + 1);
    let value = item.value?.trim() || defaultItem.value;
    let suffix = index + 1;
    while (usedValues.has(value)) {
      value = `${prefix}_${suffix}`;
      suffix += 1;
    }
    usedValues.add(value);

    return {
      ...item,
      value,
      labelKo: item.labelKo?.trim() || defaultItem.labelKo,
      labelEn: item.labelEn?.trim() || defaultItem.labelEn,
    };
  });
};

const normalizeGridConfig = (config: SurveyQuestionConfig | null) => {
  const defaults = createDefaultGridConfig();
  const rows = config?.rows?.length ? config.rows : defaults.rows;
  const columns = config?.columns?.length ? config.columns : defaults.columns;

  return {
    ...(config ?? {}),
    rows: normalizeGridOptions("rows", rows),
    columns: normalizeGridOptions("columns", columns),
  };
};

export interface QuestionFormState {
  titleKo: string;
  titleEn: string;
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
  dragHandle?: ReactNode;
  commitRef?: MutableRefObject<(() => boolean) | null>;
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
  dragHandle,
  commitRef,
  onDuplicate,
  onDelete,
  onSave,
  onCancel,
}: QuestionInlineEditorProps) {
  const [form, setForm] = useState<QuestionFormState>(() => ({
    ...initial,
    config: isGridQuestionType(initial.questionType)
      ? normalizeGridConfig(initial.config)
      : initial.config,
    answerValidationEnabled:
      initial.answerValidationEnabled ||
      Boolean(initial.answerRegex.trim() || initial.config?.validationErrorMessage?.trim()),
  }));
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const focusNewOptionRef = useRef(false);
  const lastOptionLabelRef = useRef<HTMLInputElement | null>(null);
  const focusNewGridOptionRef = useRef<"rows" | "columns" | null>(null);
  const lastGridLabelRef = useRef<Record<"rows" | "columns", HTMLInputElement | null>>({
    rows: null,
    columns: null,
  });

  const set = <K extends keyof QuestionFormState>(key: K, val: QuestionFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(form.questionType);
  const supportsBranching = form.questionType === "single_choice" || form.questionType === "dropdown";
  const isGrid = isGridQuestionType(form.questionType);
  const supportsValidation = form.questionType === "short_text" || form.questionType === "long_text";
  const gridConfig = form.config ?? { rows: [], columns: [] };
  const branchMap = form.config?.goToSectionByValue ?? {};
  const questionImage = form.config?.imageUrlKo ?? form.config?.imageUrlEn ?? null;

  const updateQuestionImage = (value: string | null) => {
    set("config", {
      ...(form.config ?? {}),
      imageUrlKo: value,
      imageUrlEn: value,
    });
  };

  const updateOptionImage = (index: number, value: string | null) => {
    const next = [...form.options];
    next[index] = {
      ...next[index],
      imageUrlKo: value,
      imageUrlEn: value,
    };
    set("options", next);
  };

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

  const createOption = (items: QuestionFormState["options"]) => ({
    value: nextUniqueValue(items, "option"),
    labelKo: `옵션 ${items.length + 1}`,
    labelEn: `Option ${items.length + 1}`,
    imageUrlKo: null,
    imageUrlEn: null,
  });

  const addOption = () => {
    focusNewOptionRef.current = true;
    set("options", [...form.options, createOption(form.options)]);
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
    field: "labelKo" | "labelEn",
    value: string,
  ) => {
    const next = [...(gridConfig[kind] ?? [])];
    next[index] = { ...next[index], [field]: value };
    set("config", { ...gridConfig, [kind]: next });
  };

  const addGridOption = (kind: "rows" | "columns") => {
    const items = gridConfig[kind] ?? [];
    const next = createDefaultGridOption(kind, items.length + 1);
    next.value = nextUniqueValue(items, kind === "rows" ? "row" : "col");
    focusNewGridOptionRef.current = kind;
    set("config", {
      ...gridConfig,
      [kind]: [...items, next],
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
    if (
      ["single_choice", "multiple_choice", "dropdown"].includes(questionType) &&
      form.options.length === 0
    ) {
      set("options", [createOption(form.options)]);
    }
    let nextConfig = form.config ? { ...form.config } : null;
    let shouldUpdateConfig = false;
    if (isGridQuestionType(questionType)) {
      nextConfig = normalizeGridConfig(nextConfig);
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
    const usedOptionValues = new Set<string>();
    const normalizedOptions = form.options.map((option, index) => {
      let value = option.value.trim() || `option_${index + 1}`;
      if (usedOptionValues.has(value)) {
        let suffix = index + 1;
        while (usedOptionValues.has(`option_${suffix}`)) suffix += 1;
        value = `option_${suffix}`;
      }
      usedOptionValues.add(value);
      return {
        ...option,
        value,
        labelKo: option.labelKo.trim() || `옵션 ${index + 1}`,
        labelEn: option.labelEn.trim() || `Option ${index + 1}`,
      };
    });
    const normalizedForm: QuestionFormState = {
      ...form,
      options: normalizedOptions,
      config: isGrid ? normalizeGridConfig(form.config) : form.config,
      titleKo: form.titleKo.trim() || "질문",
      titleEn: form.titleEn.trim() || (isKoreanOnly ? "" : "Question"),
    };

    if (needsOptions) {
      if (form.options.length === 0) {
        setError("최소 하나의 선택지가 필요합니다.");
        return false;
      }
      const optionValues = normalizedOptions.map((option) => option.value.trim());
      if (new Set(optionValues).size !== optionValues.length) {
        setError("선택지 값은 서로 달라야 합니다.");
        return false;
      }
    }

    if (supportsValidation && form.answerValidationEnabled) {
      if (!form.answerRegex.trim()) {
        setError("응답 검증을 사용하려면 정규식을 입력해주세요.");
        return false;
      }
      try {
        new RegExp(form.answerRegex.trim());
      } catch {
        setError("응답 검증 정규식이 올바르지 않습니다.");
        return false;
      }
    }

    setError(null);
    if (savingRef.current) return false;
    savingRef.current = true;
    void Promise.resolve()
      .then(() => onSave(normalizedForm))
      .finally(() => {
        savingRef.current = false;
      });
    return true;
  };

  useEffect(() => {
    if (!commitRef) return;
    const commit = handleSave;
    commitRef.current = commit;
    return () => {
      if (commitRef.current === commit) commitRef.current = null;
    };
  });

  useEffect(() => {
    if (!focusNewOptionRef.current) return;
    focusNewOptionRef.current = false;
    lastOptionLabelRef.current?.focus();
  }, [form.options.length]);

  useEffect(() => {
    const kind = focusNewGridOptionRef.current;
    if (!kind) return;
    focusNewGridOptionRef.current = null;
    lastGridLabelRef.current[kind]?.focus();
  }, [gridConfig.rows?.length, gridConfig.columns?.length]);

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

  const titleInputCls =
    "h-10 w-full !rounded-none !border-0 !bg-slate-100 px-3 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:!border-0 focus:!ring-0 disabled:cursor-not-allowed disabled:!bg-slate-100 disabled:text-slate-400 disabled:opacity-70";
  const compactInputCls =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";
  return (
    <div
      className="relative animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-xl border border-l-4 border-brand-primary/45 bg-white p-4 pb-2 pt-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] duration-200 md:p-5 md:pb-2 md:pt-4"
    >
      {dragHandle ? (
        <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2" aria-label="문항 순서 이동">
          {dragHandle}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <div className="group relative min-w-0">
          <UiInput
            autoFocus={isNewQuestion}
            aria-label="국문 질문"
            className={`${titleInputCls} min-w-0`}
            placeholder="질문"
            value={form.titleKo}
            disabled={isOngoing}
            onChange={(event) => set("titleKo", event.target.value)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-brand-primary transition-[width] duration-200 ease-out group-focus-within:w-full"
          />
        </div>
        <div className="group relative min-w-0">
          <UiInput
            aria-label="영문 질문"
            className={`${titleInputCls} min-w-0`}
            placeholder="Question"
            value={form.titleEn}
            disabled={isOngoing || isKoreanOnly}
            onChange={(event) => set("titleEn", event.target.value)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-brand-primary transition-[width] duration-200 ease-out group-focus-within:w-full"
          />
        </div>
        <CompactImagePicker
          label="문항 이미지"
          value={questionImage}
          onChange={updateQuestionImage}
          disabled={isOngoing}
        />
        <AdminSelectDropdown
          ariaLabel="질문 유형"
          value={form.questionType}
          options={QUESTION_TYPES}
          onChange={(value) => changeQuestionType(value as QuestionType)}
          disabled={isOngoing}
          className="w-full md:w-48"
          buttonClassName="!h-10 !text-sm"
        />
      </div>

      {needsOptions ? (
        <div className="mt-4 pt-1">
          <div className="scrollbar-hidden max-h-64 space-y-2 overflow-y-auto pr-1">
            {form.options.map((option, index) => (
              <div key={`${option.value}-${index}`} className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-1 py-1">
                <span className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 bg-white ${form.questionType === "single_choice" || form.questionType === "dropdown" ? "rounded-full" : "rounded"}`} aria-hidden="true" />
                <UiInput
                  ref={index === form.options.length - 1 ? lastOptionLabelRef : undefined}
                  className="!h-9 min-w-0 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                  placeholder={`옵션 ${index + 1}`}
                  aria-label={`${index + 1}번 국문 옵션`}
                  value={option.labelKo}
                  disabled={isOngoing}
                  onChange={(event) => updateOption(index, "labelKo", event.target.value)}
                />
                <UiInput
                  className="!h-9 min-w-0 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                  placeholder={`Option ${index + 1}`}
                  aria-label={`${index + 1}번 영문 옵션`}
                  value={option.labelEn}
                  disabled={isOngoing || isKoreanOnly}
                  onChange={(event) => updateOption(index, "labelEn", event.target.value)}
                />
                {supportsBranching && branchTargets.length > 0 ? (
                  <AdminSelectDropdown
                    ariaLabel={`${option.labelKo || option.value || "선택지"} 다음 섹션`}
                    className="col-span-full w-full shrink-0 sm:col-span-1 sm:w-40"
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
                  value={option.imageUrlKo ?? option.imageUrlEn ?? null}
                  onChange={(value) => updateOptionImage(index, value)}
                  disabled={isOngoing}
                />
                {!isOngoing ? (
                  form.options.length > 1 ? (
                    <IconButton
                      type="button"
                      aria-label={`${option.labelKo || option.value || "선택지"} 삭제`}
                      size="sm"
                      onClick={() => removeOption(index)}
                      className="text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  ) : null
                ) : null}
              </div>
            ))}
            {!isOngoing ? (
              <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                <span className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 text-[length:var(--ui-text-micro-size)] text-slate-300 ${form.questionType === "single_choice" || form.questionType === "dropdown" ? "rounded-full" : "rounded"}`} aria-hidden="true" />
                <UiInput
                  type="text"
                  readOnly
                  aria-label="선택지 추가"
                  placeholder="옵션 추가"
                  disabled={isOngoing}
                  onFocus={addOption}
                  className="!h-9 min-w-0 flex-1 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-400 shadow-none transition-colors placeholder:text-slate-400 hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isGrid ? (
        <div className="mt-4 pt-1">
          <div className="grid gap-3 md:grid-cols-2">
            {(["rows", "columns"] as const).map((kind) => {
              const items = gridConfig[kind] ?? [];
              const isRow = kind === "rows";
              return (
                <div key={kind} className="min-w-0">
                  <div className="mb-2 text-xs font-medium text-slate-600">
                    {isRow ? "행" : "열"}
                  </div>
                  <div className="space-y-1">
                    {items.map((option, index) => (
                      <div key={`${kind}-${index}`} className="flex min-w-0 items-center gap-2 px-1 py-1">
                        <span className="flex size-5 shrink-0 items-center justify-center text-xs tabular-nums text-slate-500" aria-hidden="true">
                          {index + 1}
                        </span>
                        <UiInput
                          ref={index === items.length - 1 ? (element) => { lastGridLabelRef.current[kind] = element; } : undefined}
                          className="!h-9 min-w-0 flex-1 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                          placeholder={`${isRow ? "행" : "열"}${index + 1}`}
                          aria-label={`${isRow ? "행" : "열"} ${index + 1} 국문 라벨`}
                          value={option.labelKo}
                          disabled={isOngoing}
                          onChange={(event) => updateGridOption(kind, index, "labelKo", event.target.value)}
                        />
                        <UiInput
                          className="!h-9 min-w-0 flex-1 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                          placeholder={`${isRow ? "row" : "col"}${index + 1}`}
                          aria-label={`${isRow ? "행" : "열"} ${index + 1} 영문 라벨`}
                          value={option.labelEn ?? ""}
                          disabled={isOngoing || isKoreanOnly}
                          onChange={(event) => updateGridOption(kind, index, "labelEn", event.target.value)}
                        />
                        {!isOngoing && items.length > 1 ? (
                          <IconButton
                            type="button"
                            aria-label={`${isRow ? "행" : "열"} ${index + 1} 삭제`}
                            size="sm"
                            onClick={() => removeGridOption(kind, index)}
                            className="text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        ) : null}
                      </div>
                    ))}
                    {!isOngoing ? (
                      <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                        <span className="flex size-5 shrink-0 items-center justify-center text-xs tabular-nums text-slate-300" aria-hidden="true">
                          {items.length + 1}
                        </span>
                        <UiInput
                          type="text"
                          readOnly
                          aria-label={isRow ? "행 추가" : "열 추가"}
                          placeholder={isRow ? "행 추가" : "열 추가"}
                          onFocus={() => addGridOption(kind)}
                          className="!h-9 min-w-0 flex-1 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-400 shadow-none transition-colors placeholder:text-slate-400 hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {form.questionType === "rating" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-1">
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

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <QuestionSwitch
              checked={form.isRequired}
              disabled={isOngoing}
              label="필수 응답"
              onChange={(checked) => set("isRequired", checked)}
            />
            {supportsValidation ? (
              <QuestionSwitch
                checked={form.answerValidationEnabled}
                disabled={isOngoing}
                label="응답 검증"
                onChange={toggleAnswerValidation}
              />
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-1">
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
          </div>
        </div>
        {supportsValidation ? (
          <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${form.answerValidationEnabled ? "mt-3 grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0 overflow-hidden">
              <UiInput
                aria-label="정규식"
                className={`${compactInputCls} w-full max-w-xl`}
                placeholder="정규식 (예: ^[0-9]+$)"
                value={form.answerRegex}
                disabled={isOngoing}
                onChange={(event) => set("answerRegex", event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function QuestionSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`inline-flex select-none items-center gap-2 text-xs font-medium text-slate-700 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <UiInput
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-5 w-9 rounded-full bg-slate-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/25 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-brand-primary peer-checked:after:translate-x-4" />
      {label}
    </label>
  );
}
