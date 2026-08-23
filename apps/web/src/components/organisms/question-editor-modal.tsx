import { useState, useEffect } from "react";
import { Check, Grid2X2, Plus, Trash2 } from "lucide-react";
import type { QuestionType, SurveyQuestionConfig } from "@soc/contracts";
import { RichTextEditor } from "./rich-text-editor";
import { Button } from "@/components/ui/button";
import { AdminFormField } from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconButton } from "@/components/ui/icon-button";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
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

export interface QuestionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  questionType: QuestionType;
  options: { value: string; labelKo: string; labelEn: string }[];
  answerRegex: string;
  isRequired: boolean;
  config: SurveyQuestionConfig | null;
}

interface QuestionEditorModalProps {
  initial: QuestionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  currentSectionId?: string;
  branchTargets?: Array<{ id: string; titleKo: string }>;
  onSave: (q: QuestionFormState) => void;
  onCancel: () => void;
}

export function QuestionEditorModal({
  initial,
  isKoreanOnly = false,
  isOngoing = false,
  currentSectionId,
  branchTargets = [],
  onSave,
  onCancel,
}: QuestionEditorModalProps) {
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
    set("options", [...form.options, { value: nextUniqueValue(form.options, "option"), labelKo: "", labelEn: "" }]);
  };

  const removeOption = (i: number) => {
    set("options", form.options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, field: "value" | "labelKo" | "labelEn", val: string) => {
    const next = [...form.options];
    const previousValue = next[i]?.value;
    next[i] = { ...next[i], [field]: val };
    set("options", next);
    if (field === "value" && previousValue && previousValue !== val) {
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
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder:text-[length:var(--ui-text-body-size)] outline-none transition-[border-color,box-shadow] placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-slate-300 focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/20 disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed";

  return (
    <AdminDrawer
      open
      onClose={onCancel}
      title={isOngoing ? "문항 보기" : initial.titleKo ? "문항 편집" : "새 문항"}
      width="max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
            {!isOngoing ? (
              <Button type="button" onClick={handleSave} className="gap-1.5 bg-brand-primary text-white hover:bg-brand-primary/90">
                <Check className="size-4" /> 문항 저장
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-6">

        {/* 언어 탭 */}
        <SegmentedControl
          ariaLabel="문항 언어"
          role="tablist"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "ko", label: "국문" },
            { value: "en", label: "영문", disabled: isKoreanOnly },
          ]}
        />

        <div className="space-y-6">
          <div>
            {activeTab === "ko" ? (
              <UiInput
                key="qTitleKo"
                className={inputCls}
                placeholder="질문을 입력하세요"
                value={form.titleKo}
                onChange={(e) => set("titleKo", e.target.value)}
              />
            ) : (
              <UiInput
                key="qTitleEn"
                className={inputCls}
                placeholder="Enter your question in English"
                value={form.titleEn}
                onChange={(e) => set("titleEn", e.target.value)}
              />
            )}
          </div>

          <div>
            {activeTab === "ko" ? (
              <RichTextEditor
                compact
                disabled={isOngoing}
                content={form.descriptionKo}
                onChange={(value) => set("descriptionKo", value)}
                lang="ko"
              />
            ) : (
              <RichTextEditor
                compact
                disabled={isOngoing}
                content={form.descriptionEn}
                onChange={(value) => set("descriptionEn", value)}
                lang="en"
              />
            )}
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-gray-100">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <AdminFormField label="질문 유형 *">
            <AdminSelectDropdown
              value={form.questionType}
              options={QUESTION_TYPES}
              onChange={(val) => changeQuestionType(val as QuestionType)}
              disabled={isOngoing}
            />
            </AdminFormField>
          </div>

          {needsOptions && (
            <div>
              <div className="mb-3 text-xs font-medium leading-4 text-slate-600">선택지</div>
              <div className="scrollbar-hidden mb-4 max-h-60 space-y-3 overflow-y-auto pr-1">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 group sm:flex-nowrap">
                    {activeTab === "ko" ? (
                      <UiInput
                        key={`labelKo-${i}`}
                        className={`${inputCls} min-w-0 flex-1`}
                        placeholder="선택지 라벨 (국문)"
                        value={opt.labelKo}
                        onChange={(e) => updateOption(i, "labelKo", e.target.value)}
                      />
                    ) : (
                      <UiInput
                        key={`labelEn-${i}`}
                        className={`${inputCls} min-w-0 flex-1`}
                        placeholder="Option label (English)"
                        value={opt.labelEn}
                        onChange={(e) => updateOption(i, "labelEn", e.target.value)}
                      />
                    )}
                    {supportsBranching && branchTargets.length > 0 && (
                      <AdminSelectDropdown
                        ariaLabel={`${opt.labelKo || opt.value || "선택지"} 다음 섹션`}
                        className="w-full shrink-0 sm:w-48"
                        value={branchMap[opt.value] ?? ""}
                        disabled={isOngoing || !opt.value.trim()}
                        onChange={(target) => updateBranchTarget(opt.value, target)}
                        options={[
                          { value: "", label: "다음 섹션" },
                          ...branchTargets
                            .filter((target) => target.id !== currentSectionId)
                            .map((target) => ({ value: target.id, label: target.titleKo })),
                          { value: "SUBMIT", label: "여기서 제출 완료" },
                        ]}
                      />
                    )}
                    {!isOngoing && (
                      <IconButton
                        aria-label={`${opt.labelKo || opt.value || "선택지"} 삭제`}
                        size="sm"
                        onClick={() => removeOption(i)}
                        className="text-kaist-grey hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
              {!isOngoing && (
                <Button variant="ghost"
                  onClick={addOption}
                  className="inline-flex items-center gap-1.5 text-kaist-darkgreen text-xs font-bold hover:bg-kaist-lightgreen/20 px-3 py-2 rounded-xl transition-all border border-kaist-darkgreen/20"
                >
                  <Plus className="w-4 h-4" />
                  선택지 추가
                </Button>
              )}
            </div>
          )}

          {isGrid && (
            <div className="space-y-5 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <div className="flex items-start gap-2.5">
                <Grid2X2 className="mt-0.5 size-4 text-brand-primary" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">그리드 구성</h4>
                  <p className="mt-0.5 text-xs font-normal text-slate-500">행과 열의 내부 키는 자동으로 생성됩니다. 운영자는 화면에 보일 라벨만 입력하면 됩니다.</p>
                </div>
              </div>
              {(["rows", "columns"] as const).map((kind) => (
                <div key={kind}>
                  <div className="mb-3 text-xs font-medium leading-4 text-slate-600">
                    {kind === "rows" ? "행(질문 항목)" : "열(선택 척도)"}
                  </div>
                  <div className="mb-3 space-y-2">
                    {(gridConfig[kind] ?? []).map((option, index) => (
                      <div key={`${kind}-${index}`} className="flex items-center gap-2">
                        <UiInput
                          className={`${inputCls} flex-1`}
                          placeholder={activeTab === "ko" ? "국문 라벨" : "English label"}
                          value={activeTab === "ko" ? option.labelKo : option.labelEn}
                          disabled={isOngoing}
                          onChange={(event) => updateGridOption(kind, index, activeTab === "ko" ? "labelKo" : "labelEn", event.target.value)}
                        />
                        {!isOngoing && (
                          <IconButton
                            aria-label={`${kind === "rows" ? "행" : "열"} ${index + 1} 삭제`}
                            size="sm"
                            onClick={() => removeGridOption(kind, index)}
                            className="text-kaist-grey hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isOngoing && (
                    <Button variant="ghost" type="button" onClick={() => addGridOption(kind)} className="inline-flex items-center gap-1.5 rounded-xl border border-kaist-darkgreen/20 px-3 py-2 text-xs font-bold text-kaist-darkgreen transition hover:bg-kaist-lightgreen/20">
                      <Plus className="h-4 w-4" /> {kind === "rows" ? "행 추가" : "열 추가"}
                    </Button>
                  )}
                </div>
              ))}

              {(gridConfig.rows?.length ?? 0) > 0 && (gridConfig.columns?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[520px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">미리보기</th>
                        {(gridConfig.columns ?? []).map((column) => (
                          <th key={column.value} className="px-3 py-2 text-center font-medium text-slate-600">{column.labelKo || "열"}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(gridConfig.rows ?? []).map((row) => (
                        <tr key={row.value} className="border-b border-slate-100 last:border-b-0">
                          <th className="px-3 py-2.5 text-left font-medium text-slate-700">{row.labelKo || "행"}</th>
                          {(gridConfig.columns ?? []).map((column) => (
                            <td key={`${row.value}-${column.value}`} className="px-3 py-2.5 text-center">
                              <span className={`inline-block size-4 border border-slate-300 bg-white ${form.questionType === "grid_single" ? "rounded-full" : "rounded"}`} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-kaist-grey/5">
            <span className="text-sm font-bold text-kaist-black">필수 응답</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <UiInput
                type="checkbox"
                className="sr-only peer"
                checked={form.isRequired}
                onChange={(e) => set("isRequired", e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-kaist-darkgreen/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kaist-darkgreen"></div>
            </label>
          </div>

          {form.questionType === "short_text" && (
            <AdminFormField label="응답 정규식 (선택)">
              <UiInput
                className={inputCls}
                placeholder="예: ^[0-9]+$"
                value={form.answerRegex}
                onChange={(e) => set("answerRegex", e.target.value)}
              />
            </AdminFormField>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}
        </div>

      </div>
    </AdminDrawer>
  );
}
