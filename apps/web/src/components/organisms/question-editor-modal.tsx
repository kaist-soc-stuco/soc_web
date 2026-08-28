import { useState, useEffect } from "react";
import { Check, Grid2X2, ImagePlus, Plus, Trash2 } from "lucide-react";
import type { QuestionType, SurveyQuestionConfig } from "@soc/contracts";
import { Button } from "@/components/ui/button";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
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
  isRequired: boolean;
  config: SurveyQuestionConfig | null;
}

interface QuestionInlineEditorProps {
  initial: QuestionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  currentSectionId?: string;
  branchTargets?: Array<{ id: string; titleKo: string }>;
  onSave: (q: QuestionFormState) => void;
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
  onSave,
  onCancel,
}: QuestionInlineEditorProps) {
  const [form, setForm] = useState<QuestionFormState>(initial);
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [error, setError] = useState<string | null>(null);

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
    if ((questionType === "grid_single" || questionType === "grid_multiple") && !form.config) {
      set("config", {
        rows: [
          { value: "row_1", labelKo: "항목 1", labelEn: "Item 1" },
          { value: "row_2", labelKo: "항목 2", labelEn: "Item 2" },
        ],
        columns: [
          { value: "column_1", labelKo: "선택 1", labelEn: "Choice 1" },
          { value: "column_2", labelKo: "선택 2", labelEn: "Choice 2" },
          { value: "column_3", labelKo: "선택 3", labelEn: "Choice 3" },
        ],
      });
    }
    if (questionType === "rating") {
      set("config", { ...(form.config ?? {}), ratingMax: form.config?.ratingMax ?? 5 });
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

    setError(null);
    onSave(form);
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";
  const compactInputCls =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";
  const questionTypeLabel = QUESTION_TYPES.find((type) => type.value === form.questionType)?.label;

  return (
    <div className="rounded-xl border border-brand-primary/35 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-slate-900">
            {isOngoing ? "문항 보기" : initial.titleKo ? "문항 편집" : "새 문항"}
          </span>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {questionTypeLabel}
          </span>
        </div>
        <SegmentedControl
          ariaLabel="문항 언어"
          role="tablist"
          value={activeTab}
          onChange={setActiveTab}
          itemClassName="!h-8 !min-h-8 !px-2.5 !text-xs"
          options={[
            { value: "ko", label: "국문" },
            { value: "en", label: "영문", disabled: isKoreanOnly },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            {activeTab === "ko" ? "질문 제목" : "Question title"} <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <UiInput
              autoFocus
              className={`${inputCls} min-w-0 flex-1`}
              placeholder={activeTab === "ko" ? "질문을 입력하세요" : "Enter your question"}
              value={activeTab === "ko" ? form.titleKo : form.titleEn}
              disabled={isOngoing}
              onChange={(event) => set(activeTab === "ko" ? "titleKo" : "titleEn", event.target.value)}
            />
            <CompactImagePicker
              label={activeTab === "ko" ? "문항 이미지" : "Question image"}
              value={activeTab === "ko" ? form.config?.imageUrlKo : form.config?.imageUrlEn}
              onChange={(value) => set("config", {
                ...(form.config ?? {}),
                [activeTab === "ko" ? "imageUrlKo" : "imageUrlEn"]: value,
              })}
              disabled={isOngoing}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">질문 유형</label>
          <AdminSelectDropdown
            ariaLabel="질문 유형"
            value={form.questionType}
            options={QUESTION_TYPES}
            onChange={(value) => changeQuestionType(value as QuestionType)}
            disabled={isOngoing}
            buttonClassName="!h-10 !text-sm"
          />
        </div>
      </div>

      {needsOptions ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600">선택지</span>
            {!isOngoing ? (
              <Button type="button" variant="ghost" size="sm" onClick={addOption} className="!h-8 !px-2.5 !text-xs !font-medium text-brand-primary hover:bg-emerald-50">
                <Plus className="size-3.5" /> 선택지 추가
              </Button>
            ) : null}
          </div>
          <div className="scrollbar-hidden max-h-64 space-y-2 overflow-y-auto pr-1">
            {form.options.map((option, index) => (
              <div key={`${option.value}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/40 px-2 py-1.5">
                <span className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 bg-white text-[length:var(--ui-text-micro-size)] text-slate-400 ${form.questionType === "single_choice" || form.questionType === "dropdown" ? "rounded-full" : "rounded"}`} aria-hidden="true">
                  {form.questionType === "multiple_choice" ? "✓" : ""}
                </span>
                <UiInput
                  className={`${compactInputCls} min-w-[12rem] flex-1`}
                  placeholder={activeTab === "ko" ? "선택지 라벨" : "Option label"}
                  aria-label={`${index + 1}번 ${activeTab === "ko" ? "국문 라벨" : "영문 라벨"}`}
                  value={activeTab === "ko" ? option.labelKo : option.labelEn}
                  disabled={isOngoing}
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
                  label={activeTab === "ko" ? "선택지 이미지" : "Option image"}
                  value={activeTab === "ko" ? option.imageUrlKo : option.imageUrlEn}
                  onChange={(value) => updateOption(index, activeTab === "ko" ? "imageUrlKo" : "imageUrlEn", value)}
                  disabled={isOngoing}
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
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center gap-2">
            <Grid2X2 className="size-4 text-brand-primary" />
            <h4 className="text-xs font-semibold text-slate-700">그리드 구성</h4>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["rows", "columns"] as const).map((kind) => (
              <div key={kind} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5">
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
                        disabled={isOngoing}
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
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
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

      {form.questionType === "short_text" ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-3 text-xs font-medium text-slate-600">
            <span className="shrink-0">응답 정규식 (선택)</span>
            <UiInput
              className={`${compactInputCls} min-w-0 flex-1`}
              placeholder="예: ^[0-9]+$"
              value={form.answerRegex}
              disabled={isOngoing}
              onChange={(event) => set("answerRegex", event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
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
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {isOngoing ? "닫기" : "취소"}
          </Button>
          {!isOngoing ? (
            <Button type="button" size="sm" onClick={handleSave} className="gap-1.5 bg-brand-primary text-white hover:bg-brand-primary/90">
              <Check className="size-4" /> 문항 저장
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
