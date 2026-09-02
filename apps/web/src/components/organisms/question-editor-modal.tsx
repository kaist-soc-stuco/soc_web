import { createPortal } from "react-dom";
import { createApiClient } from "@soc/api-client";
import type { QuestionType, SurveyQuestionConfig } from "@soc/contracts";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Copy,
  GripVertical,
  ImagePlus,
  Loader2,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";

import { Button } from "@/components/ui/button";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";

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

type ValidationType = NonNullable<SurveyQuestionConfig["validationType"]>;
type ValidationOperator = NonNullable<SurveyQuestionConfig["validationOperator"]>;

const VALIDATION_TYPE_OPTIONS: Array<{ value: ValidationType; label: string }> = [
  { value: "number", label: "숫자" },
  { value: "text", label: "텍스트" },
  { value: "length", label: "길이" },
  { value: "regex", label: "정규 표현식" },
];

const TEXT_VALIDATION_OPTIONS: Array<{ value: "length" | "regex"; label: string }> = [
  { value: "length", label: "길이" },
  { value: "regex", label: "정규 표현식" },
];

const LENGTH_OPERATOR_OPTIONS: Array<{ value: ValidationOperator; label: string }> = [
  { value: "max_length", label: "최대 문자 수" },
  { value: "min_length", label: "최소 문자 수" },
];

const NUMBER_OPERATOR_OPTIONS: Array<{ value: ValidationOperator; label: string }> = [
  { value: "greater", label: "초과" },
  { value: "greater_or_equal", label: "크거나 같음" },
  { value: "less", label: "미만" },
  { value: "less_or_equal", label: "작거나 같음" },
  { value: "equal", label: "같음" },
  { value: "not_equal", label: "같지 않음" },
  { value: "between", label: "사이값" },
  { value: "not_between", label: "사이값 제외" },
  { value: "is_number", label: "숫자임" },
  { value: "integer", label: "정수" },
];

const CHECKBOX_OPERATOR_OPTIONS: Array<{ value: ValidationOperator; label: string }> = [
  { value: "min", label: "최소 선택 개수" },
  { value: "max", label: "최대 선택 개수" },
  { value: "equal", label: "정확한 선택 개수" },
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
  onError,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
}) {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.("이미지 파일만 등록할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const asset = await client.uploadAsset(file);
      onChange(asset.storageKey);
    } catch {
      onError?.("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  if (value) return null;

  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handleFileSelection(event)}
      />
      <IconButton
        type="button"
        size="sm"
        aria-label={`${label} ${value ? "변경" : "추가"}`}
        aria-busy={uploading}
        disabled={disabled || uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      </IconButton>
    </div>
  );
}

function ImagePreview({
  label,
  value,
  disabled = false,
  onRemove,
  className = "",
}: {
  label: string;
  value?: string | null;
  disabled?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  if (!value) return null;

  return (
    <div className={`group relative w-fit max-w-full ${className}`}>
      <div className="max-w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
        <img
          src={resolveAssetUrl(value)}
          alt={`${label} 미리보기`}
          className="block max-h-32 max-w-[14rem] object-contain"
        />
      </div>
      {!disabled && onRemove ? (
        <button
          type="button"
          aria-label={`${label} 삭제`}
          onClick={onRemove}
          className="absolute -right-2 -top-2 inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition-opacity hover:bg-slate-50 hover:text-slate-800 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 group-hover:opacity-100"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

interface SortableOptionRowProps {
  id: string;
  option: QuestionFormState["options"][number];
  index: number;
  optionCount: number;
  questionType: QuestionType;
  isKoreanOnly: boolean;
  isOngoing: boolean;
  lastOptionLabelRef: MutableRefObject<HTMLInputElement | null>;
  hasBranchingControls: boolean;
  branchMap: Record<string, string>;
  branchTargets: Array<{ id: string; titleKo: string }>;
  currentSectionId?: string;
  onUpdateOption: (
    index: number,
    field: "value" | "labelKo" | "labelEn" | "imageUrlKo" | "imageUrlEn",
    value: string | null,
  ) => void;
  onUpdateOptionImage: (index: number, value: string | null) => void;
  onUpdateBranchTarget: (optionValue: string, target: string) => void;
  onRemoveOption: (index: number) => void;
  onError: (message: string) => void;
}

function SortableOptionRow({
  id,
  option,
  index,
  optionCount,
  questionType,
  isKoreanOnly,
  isOngoing,
  lastOptionLabelRef,
  hasBranchingControls,
  branchMap,
  branchTargets,
  currentSectionId,
  onUpdateOption,
  onUpdateOptionImage,
  onUpdateBranchTarget,
  onRemoveOption,
  onError,
}: SortableOptionRowProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isOngoing });
  const optionImage = option.imageUrlKo ?? option.imageUrlEn ?? null;
  const isCircular = questionType === "single_choice" || questionType === "dropdown";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`group min-w-0 rounded-lg px-1 py-1.5 transition-colors hover:bg-slate-50/70 ${
        isDragging ? "bg-emerald-50 shadow-md" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {!isOngoing ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`${option.labelKo || option.value || "선택지"} 순서 이동`}
            aria-grabbed={isDragging ? "true" : undefined}
            className="inline-flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-300 opacity-0 outline-none transition-opacity hover:text-slate-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-primary/25 group-hover:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <span aria-hidden="true" className="size-5 shrink-0" />
        )}
        <span
          className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 bg-white ${
            isCircular ? "rounded-full" : "rounded"
          }`}
          aria-hidden="true"
        />
        <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
          <UiInput
            ref={index === optionCount - 1 ? (element) => { lastOptionLabelRef.current = element; } : undefined}
            className="!h-9 min-w-0 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
            placeholder={`옵션 ${index + 1}`}
            aria-label={`${index + 1}번 국문 옵션`}
            value={option.labelKo}
            disabled={isOngoing}
            onChange={(event) => onUpdateOption(index, "labelKo", event.target.value)}
          />
          <UiInput
            className="!h-9 min-w-0 !rounded-none !border-0 !border-b !border-transparent !bg-transparent px-1.5 text-sm font-normal text-slate-900 shadow-none transition-colors hover:!border-b-slate-300 focus:!border-b-brand-primary focus:!ring-0"
            placeholder={`Option ${index + 1}`}
            aria-label={`${index + 1}번 영문 옵션`}
            value={option.labelEn}
            disabled={isOngoing || isKoreanOnly}
            onChange={(event) => onUpdateOption(index, "labelEn", event.target.value)}
          />
        </div>
        {!optionImage ? (
          <CompactImagePicker
            label="선택지 이미지"
            value={null}
            onChange={(value) => onUpdateOptionImage(index, value)}
            disabled={isOngoing}
            onError={onError}
          />
        ) : null}
        {!isOngoing && optionCount > 1 ? (
          <IconButton
            type="button"
            aria-label={`${option.labelKo || option.value || "선택지"} 삭제`}
            size="sm"
            onClick={() => onRemoveOption(index)}
            className="text-slate-400 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="size-4" />
          </IconButton>
        ) : null}
      </div>
      {hasBranchingControls ? (
        <div className="mt-1 pl-[4.5rem] md:pl-[4.5rem]">
          <AdminSelectDropdown
            ariaLabel={`${option.labelKo || option.value || "선택지"} 다음 섹션`}
            className="w-full md:w-52"
            value={branchMap[option.value] ?? ""}
            disabled={isOngoing || !option.value.trim()}
            onChange={(target) => onUpdateBranchTarget(option.value, target)}
            options={[
              { value: "", label: "다음 섹션" },
              ...branchTargets
                .filter((target) => target.id !== currentSectionId)
                .map((target) => ({ value: target.id, label: target.titleKo })),
              { value: "SUBMIT", label: "설문지 제출" },
            ]}
          />
        </div>
      ) : null}
      <ImagePreview
        label="선택지 이미지"
        value={optionImage}
        disabled={isOngoing}
        onRemove={() => onUpdateOptionImage(index, null)}
        className="ml-[4.5rem] mt-2"
      />
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
  const { toast } = useToast();
  const [form, setForm] = useState<QuestionFormState>(() => ({
    ...initial,
    config: isGridQuestionType(initial.questionType)
      ? normalizeGridConfig(initial.config)
      : initial.config,
    answerValidationEnabled:
      initial.answerValidationEnabled ||
      Boolean(
        initial.answerRegex.trim() ||
          initial.config?.validationErrorMessage?.trim() ||
          initial.config?.validationType,
      ),
  }));
  const [error, setError] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(
    () => Boolean(initial.descriptionKo.trim() || initial.descriptionEn.trim()),
  );
  const [branchingEnabled, setBranchingEnabled] = useState(
    () =>
      initial.config?.branchingEnabled === true ||
      Object.keys(initial.config?.goToSectionByValue ?? {}).length > 0,
  );
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuContentRef = useRef<HTMLDivElement>(null);
  const [moreMenuStyle, setMoreMenuStyle] = useState<CSSProperties>({
    visibility: "hidden",
  });
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

  const optionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(form.questionType);
  const supportsBranching = form.questionType === "single_choice" || form.questionType === "dropdown";
  const isGrid = isGridQuestionType(form.questionType);
  const supportsValidation =
    form.questionType === "short_text" ||
    form.questionType === "long_text" ||
    form.questionType === "multiple_choice";
  const gridConfig = form.config ?? { rows: [], columns: [] };
  const branchMap = form.config?.goToSectionByValue ?? {};
  const questionImage = form.config?.imageUrlKo ?? form.config?.imageUrlEn ?? null;
  const hasBranchingControls =
    supportsBranching && branchTargets.length > 0 && branchingEnabled;
  const validationType: ValidationType =
    form.questionType === "multiple_choice"
      ? "checkbox_count"
      : form.config?.validationType === "checkbox_count"
        ? "length"
        : form.config?.validationType ??
          (form.answerRegex.trim() ? "regex" : "length");
  const validationTextType: "length" | "regex" =
    form.config?.validationTextType ??
    (validationType === "regex" ? "regex" : "length");
  const configuredValidationOperator = form.config?.validationOperator;
  const validationOperator: ValidationOperator =
    validationType === "number"
      ? configuredValidationOperator ?? "greater"
      : validationType === "checkbox_count"
        ? configuredValidationOperator ?? "min"
        : validationType === "length" || validationTextType === "length"
          ? configuredValidationOperator === "max" ||
            configuredValidationOperator === "max_length"
            ? "max_length"
            : "min_length"
          : configuredValidationOperator ?? "min";
  const validationValue = form.config?.validationValue ?? 1;
  const validationValueMax = form.config?.validationValueMax ?? validationValue + 1;

  const updateConfig = (updates: Partial<SurveyQuestionConfig>) => {
    set("config", { ...(form.config ?? {}), ...updates });
  };

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
    nextConfig.branchingEnabled = true;
    if (Object.keys(nextMap).length > 0) {
      nextConfig.goToSectionByValue = nextMap;
    } else {
      delete nextConfig.goToSectionByValue;
    }
    set("config", nextConfig);
  };

  const toggleBranching = (enabled: boolean) => {
    setBranchingEnabled(enabled);
    const nextConfig = { ...(form.config ?? {}) };
    nextConfig.branchingEnabled = enabled;
    if (!enabled) delete nextConfig.goToSectionByValue;
    set("config", nextConfig);
  };

  const toggleDateSetting = (key: "dateIncludeTime" | "dateIncludeYear") => {
    const defaultValue = key === "dateIncludeYear";
    updateConfig({ [key]: !(form.config?.[key] ?? defaultValue) });
  };

  const updateValidation = (updates: Partial<SurveyQuestionConfig>) => {
    updateConfig({
      validationType,
      validationTextType,
      validationOperator,
      validationValue,
      validationValueMax,
      ...updates,
    });
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

  const moveOption = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const next = [...form.options];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    set("options", next);
  };

  const handleOptionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const optionIndex = (id: string | number) => Number(String(id).replace("option-", ""));
    const fromIndex = optionIndex(active.id);
    const toIndex = optionIndex(over.id);
    if (Number.isInteger(fromIndex) && Number.isInteger(toIndex)) {
      moveOption(fromIndex, toIndex);
    }
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
    const nextSupportsValidation =
      questionType === "short_text" ||
      questionType === "long_text" ||
      questionType === "multiple_choice";
    const checkboxValidationTypeChanged =
      (form.questionType === "multiple_choice") !==
      (questionType === "multiple_choice");
    if (!nextSupportsValidation || checkboxValidationTypeChanged) {
      set("answerRegex", "");
      set("answerValidationEnabled", false);
      if (nextConfig) {
        delete nextConfig.validationErrorMessage;
        delete nextConfig.validationType;
        delete nextConfig.validationTextType;
        delete nextConfig.validationOperator;
        delete nextConfig.validationValue;
        delete nextConfig.validationValueMax;
        shouldUpdateConfig = true;
      }
    }
    if (!isGridQuestionType(questionType) && nextConfig?.rows && nextConfig?.columns) {
      delete nextConfig.rows;
      delete nextConfig.columns;
      shouldUpdateConfig = true;
    }
    if (questionType !== "single_choice" && questionType !== "dropdown") {
      setBranchingEnabled(false);
      if (nextConfig?.goToSectionByValue || nextConfig?.branchingEnabled) {
        delete nextConfig.goToSectionByValue;
        delete nextConfig.branchingEnabled;
        shouldUpdateConfig = true;
      }
    }
    if (shouldUpdateConfig) {
      set("config", nextConfig && Object.keys(nextConfig).length > 0 ? nextConfig : null);
    }
  };

  const toggleAnswerValidation = (enabled: boolean) => {
    set("answerValidationEnabled", enabled);
    if (enabled) {
      updateConfig({
        validationType:
          form.config?.validationType ??
          (form.questionType === "multiple_choice" ? "checkbox_count" : "length"),
        validationTextType: form.config?.validationTextType ?? "length",
        validationOperator:
          form.config?.validationOperator ??
          (form.questionType === "multiple_choice" ? "min" : "min_length"),
        validationValue: form.config?.validationValue ?? 1,
        validationValueMax: form.config?.validationValueMax ?? 2,
      });
      return;
    }

    if (!enabled) {
      set("answerRegex", "");
      const nextConfig = { ...(form.config ?? {}) };
      delete nextConfig.validationErrorMessage;
      delete nextConfig.validationType;
      delete nextConfig.validationTextType;
      delete nextConfig.validationOperator;
      delete nextConfig.validationValue;
      delete nextConfig.validationValueMax;
      set("config", Object.keys(nextConfig).length > 0 ? nextConfig : null);
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
    let normalizedConfig = isGrid ? normalizeGridConfig(form.config) : form.config;
    if (supportsValidation && form.answerValidationEnabled) {
      normalizedConfig = {
        ...(normalizedConfig ?? {}),
        validationType,
        validationTextType,
        validationOperator,
        ...(validationType === "regex" || validationTextType === "regex"
          ? {}
          : { validationValue }),
        ...(validationType === "number" &&
        (validationOperator === "between" || validationOperator === "not_between")
          ? { validationValueMax }
          : {}),
      };
    }
    const normalizedForm: QuestionFormState = {
      ...form,
      options: normalizedOptions,
      config: normalizedConfig,
      titleKo: form.titleKo.trim() || "질문",
      titleEn: form.titleEn.trim() || (isKoreanOnly ? "" : "Question"),
      descriptionKo: form.descriptionKo.trim(),
      descriptionEn: form.descriptionEn.trim(),
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
      if (validationType === "regex" || validationTextType === "regex") {
        if (!form.answerRegex.trim()) {
          setError("응답 검증 정규식을 입력해주세요.");
          return false;
        }
        try {
          new RegExp(form.answerRegex.trim());
        } catch {
          setError("응답 검증 정규식이 올바르지 않습니다.");
          return false;
        }
      } else if (!Number.isInteger(validationValue) || validationValue < 0) {
        setError("응답 검증 기준은 0 이상의 정수로 입력해주세요.");
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
        if (moreMenuOpen) {
          event.preventDefault();
          setMoreMenuOpen(false);
          return;
        }
        if (document.querySelector(".ui-select-dropdown-menu")) return;
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [moreMenuOpen, onCancel]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !moreMenuRef.current?.contains(target) &&
        !moreMenuContentRef.current?.contains(target)
      ) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [moreMenuOpen]);

  useLayoutEffect(() => {
    if (!moreMenuOpen || typeof window === "undefined") {
      setMoreMenuStyle({ visibility: "hidden" });
      return;
    }

    const updateMoreMenuPosition = () => {
      const trigger = moreMenuButtonRef.current;
      const menu = moreMenuContentRef.current;
      if (!trigger || !menu) return;

      const viewportPadding = 8;
      const gap = 8;
      const maxMenuHeight = 360;
      const triggerRect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(320, Math.max(0, window.innerWidth - viewportPadding * 2));
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const spaceAbove = triggerRect.top - viewportPadding;
      const naturalHeight = Math.min(menu.scrollHeight, maxMenuHeight);
      const opensUp = spaceBelow < naturalHeight + gap && spaceAbove > spaceBelow;
      const availableHeight = Math.max(
        1,
        (opensUp ? spaceAbove : spaceBelow) - gap,
      );
      const positionedHeight = Math.min(menu.scrollHeight, maxMenuHeight, availableHeight);
      const top = opensUp
        ? Math.max(viewportPadding, triggerRect.top - positionedHeight - gap)
        : Math.min(
            triggerRect.bottom + gap,
            Math.max(viewportPadding, window.innerHeight - positionedHeight - viewportPadding),
          );
      const left = Math.min(
        Math.max(viewportPadding, triggerRect.right - menuWidth),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      );

      setMoreMenuStyle({
        left,
        maxHeight: positionedHeight,
        top,
        visibility: "visible",
        width: menuWidth,
      });
    };

    const frame = window.requestAnimationFrame(updateMoreMenuPosition);
    window.addEventListener("resize", updateMoreMenuPosition);
    window.addEventListener("scroll", updateMoreMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMoreMenuPosition);
      window.removeEventListener("scroll", updateMoreMenuPosition, true);
    };
  }, [moreMenuOpen]);

  const titleInputCls =
    "h-10 w-full !rounded-none !border-0 !bg-slate-100 px-3 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:!border-0 focus:!ring-0 disabled:cursor-not-allowed disabled:!bg-slate-100 disabled:text-slate-400 disabled:opacity-70";
  return (
    <div
      className="relative animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pb-7 pt-7 shadow-[0_8px_24px_rgba(15,23,42,0.06)] duration-200 md:p-5 md:pb-8 md:pt-7"
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
            autoFocus
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
          onError={(message) => toast({ type: "error", message })}
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

      {showDescription ? (
        <div className="mt-2 grid min-w-0 gap-3 md:grid-cols-2">
          <UiInput
            aria-label="국문 설명"
            className={`${titleInputCls} min-w-0`}
            placeholder="설명"
            value={form.descriptionKo}
            disabled={isOngoing}
            onChange={(event) => set("descriptionKo", event.target.value)}
          />
          {!isKoreanOnly ? (
            <UiInput
              aria-label="영문 설명"
              className={`${titleInputCls} min-w-0`}
              placeholder="Description"
              value={form.descriptionEn}
              disabled={isOngoing}
              onChange={(event) => set("descriptionEn", event.target.value)}
            />
          ) : null}
        </div>
      ) : null}

      {questionImage ? (
        <ImagePreview
          label="문항 이미지"
          value={questionImage}
          disabled={isOngoing}
          onRemove={() => updateQuestionImage(null)}
          className="mt-3"
        />
      ) : null}

      {needsOptions ? (
        <div className="mt-4 pb-2 pt-1">
          <div className="scrollbar-hidden max-h-80 space-y-1 overflow-y-auto pr-1">
            <DndContext
              sensors={optionSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleOptionDragEnd}
            >
              <SortableContext
                items={form.options.map((_, index) => `option-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                {form.options.map((option, index) => (
                  <SortableOptionRow
                    key={`${option.value}-${index}`}
                    id={`option-${index}`}
                    option={option}
                    index={index}
                    optionCount={form.options.length}
                    questionType={form.questionType}
                    isKoreanOnly={isKoreanOnly}
                    isOngoing={isOngoing}
                    lastOptionLabelRef={lastOptionLabelRef}
                    hasBranchingControls={hasBranchingControls}
                    branchMap={branchMap}
                    branchTargets={branchTargets}
                    currentSectionId={currentSectionId}
                    onUpdateOption={updateOption}
                    onUpdateOptionImage={updateOptionImage}
                    onUpdateBranchTarget={updateBranchTarget}
                    onRemoveOption={removeOption}
                    onError={(message) => toast({ type: "error", message })}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {!isOngoing ? (
              <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                <span aria-hidden="true" className="size-5 shrink-0" />
                <span
                  className={`flex size-5 shrink-0 items-center justify-center border border-slate-300 text-[length:var(--ui-text-micro-size)] text-slate-300 ${form.questionType === "single_choice" || form.questionType === "dropdown" ? "rounded-full" : "rounded"}`}
                  aria-hidden="true"
                />
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

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          </div>
          <div ref={moreMenuRef} className="relative ml-auto flex items-center gap-3">
            <span aria-hidden="true" className="h-6 border-l border-slate-200" />
            <QuestionSwitch
              checked={form.isRequired}
              disabled={isOngoing}
              label="필수 입력란입니다"
              onChange={(checked) => set("isRequired", checked)}
            />
            <IconButton
              type="button"
              size="sm"
              aria-label="문항 더보기"
              ref={moreMenuButtonRef}
              aria-expanded={moreMenuOpen}
              disabled={isOngoing}
              onClick={() => setMoreMenuOpen((open) => !open)}
              className={moreMenuOpen ? "border-slate-200 bg-slate-50 text-slate-900" : ""}
            >
              <MoreVertical aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
          {moreMenuOpen && typeof document !== "undefined"
            ? createPortal(
                <QuestionMoreMenu
                  menuRef={moreMenuContentRef}
                  menuStyle={moreMenuStyle}
                  disabled={isOngoing}
                  descriptionEnabled={showDescription}
                  onDescriptionToggle={() => setShowDescription((visible) => !visible)}
                  validationEnabled={form.answerValidationEnabled}
                  onValidationToggle={toggleAnswerValidation}
                  canValidate={supportsValidation}
                  branchingEnabled={hasBranchingControls}
                  onBranchingToggle={toggleBranching}
                  canBranch={supportsBranching && branchTargets.length > 0}
                  shuffleOptions={Boolean(form.config?.shuffleOptions)}
                  canShuffle={needsOptions}
                  onShuffleToggle={() => updateConfig({ shuffleOptions: !form.config?.shuffleOptions })}
                  questionType={form.questionType}
                  dateIncludeTime={form.config?.dateIncludeTime ?? false}
                  dateIncludeYear={form.config?.dateIncludeYear ?? true}
                  onDateIncludeTimeToggle={() => toggleDateSetting("dateIncludeTime")}
                  onDateIncludeYearToggle={() => toggleDateSetting("dateIncludeYear")}
                  timeAnswerType={form.config?.timeAnswerType ?? "time"}
                  onTimeAnswerTypeChange={(value) => updateConfig({ timeAnswerType: value })}
                />,
                document.body,
              )
            : null}
        </div>
        {supportsValidation ? (
          <QuestionValidationEditor
            enabled={form.answerValidationEnabled}
            questionType={form.questionType}
            validationType={validationType}
            validationTextType={validationTextType}
            validationOperator={validationOperator}
            validationValue={validationValue}
            validationValueMax={validationValueMax}
            regex={form.answerRegex}
            errorMessage={form.config?.validationErrorMessage ?? ""}
            disabled={isOngoing}
            onTypeChange={(value) => {
              const nextOperator =
                value === "number"
                  ? "greater"
                  : value === "length" || value === "text"
                    ? "min_length"
                    : "min";
              updateValidation({
                validationType: value,
                validationTextType: value === "regex" ? "regex" : "length",
                validationOperator: nextOperator,
                validationValue: 1,
              });
              if (value !== "regex") set("answerRegex", "");
            }}
            onTextTypeChange={(value) =>
              updateValidation({
                validationType: "text",
                validationTextType: value,
                validationOperator: value === "length" ? "min_length" : "min",
                validationValue: 1,
              })
            }
            onOperatorChange={(value) => updateValidation({ validationOperator: value })}
            onValueChange={(value) => updateValidation({ validationValue: value })}
            onValueMaxChange={(value) => updateValidation({ validationValueMax: value })}
            onRegexChange={(value) => set("answerRegex", value)}
            onErrorMessageChange={(value) => updateConfig({ validationErrorMessage: value })}
            onRemove={() => toggleAnswerValidation(false)}
          />
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
    <label className={`inline-flex select-none items-center gap-2 text-sm font-medium text-slate-700 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <UiInput
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
      <span className="relative h-5 w-9 rounded-full bg-slate-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/25 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-brand-primary peer-checked:after:translate-x-4" />
    </label>
  );
}

function QuestionMoreMenu({
  menuRef,
  menuStyle,
  disabled,
  descriptionEnabled,
  onDescriptionToggle,
  validationEnabled,
  onValidationToggle,
  canValidate,
  branchingEnabled,
  onBranchingToggle,
  canBranch,
  shuffleOptions,
  canShuffle,
  onShuffleToggle,
  questionType,
  dateIncludeTime,
  dateIncludeYear,
  onDateIncludeTimeToggle,
  onDateIncludeYearToggle,
  timeAnswerType,
  onTimeAnswerTypeChange,
}: {
  menuRef: Ref<HTMLDivElement>;
  menuStyle: CSSProperties;
  disabled: boolean;
  descriptionEnabled: boolean;
  onDescriptionToggle: () => void;
  validationEnabled: boolean;
  onValidationToggle: (enabled: boolean) => void;
  canValidate: boolean;
  branchingEnabled: boolean;
  onBranchingToggle: (enabled: boolean) => void;
  canBranch: boolean;
  shuffleOptions: boolean;
  canShuffle: boolean;
  onShuffleToggle: () => void;
  questionType: QuestionType;
  dateIncludeTime: boolean;
  dateIncludeYear: boolean;
  onDateIncludeTimeToggle: () => void;
  onDateIncludeYearToggle: () => void;
  timeAnswerType: NonNullable<SurveyQuestionConfig["timeAnswerType"]>;
  onTimeAnswerTypeChange: (
    value: NonNullable<SurveyQuestionConfig["timeAnswerType"]>,
  ) => void;
}) {
  return (
    <div
      ref={menuRef}
      style={menuStyle}
      role="menu"
      aria-label="문항 옵션"
      className="fixed z-[100] max-h-[22.5rem] min-w-64 overflow-x-hidden overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
    >
      <MoreMenuItem
        label="설명"
        checked={descriptionEnabled}
        disabled={disabled}
        onClick={onDescriptionToggle}
      />
      {canValidate ? (
        <MoreMenuItem
          label="응답 확인"
          checked={validationEnabled}
          disabled={disabled}
          onClick={() => onValidationToggle(!validationEnabled)}
        />
      ) : null}
      {canBranch ? (
        <MoreMenuItem
          label="답변을 기준으로 섹션 이동"
          checked={branchingEnabled}
          disabled={disabled}
          onClick={() => onBranchingToggle(!branchingEnabled)}
        />
      ) : null}
      {canShuffle ? (
        <>
          <div className="my-1 border-t border-slate-100" />
          <MoreMenuItem
            label="옵션 순서 무작위로 섞기"
            checked={shuffleOptions}
            disabled={disabled}
            onClick={onShuffleToggle}
          />
        </>
      ) : null}
      {questionType === "date" ? (
        <>
          <div className="my-1 border-t border-slate-100" />
          <MoreMenuItem
            label="시간 포함"
            checked={dateIncludeTime}
            disabled={disabled}
            onClick={onDateIncludeTimeToggle}
          />
          <MoreMenuItem
            label="연도 포함"
            checked={dateIncludeYear}
            disabled={disabled}
            onClick={onDateIncludeYearToggle}
          />
        </>
      ) : null}
      {questionType === "time" ? (
        <>
          <div className="my-1 border-t border-slate-100" />
          <div className="px-3 pb-1 pt-2 text-xs font-medium text-slate-400">답변 유형</div>
          <MoreMenuItem
            label="시간"
            checked={timeAnswerType === "time"}
            disabled={disabled}
            onClick={() => onTimeAnswerTypeChange("time")}
          />
          <MoreMenuItem
            label="기간"
            checked={timeAnswerType === "duration"}
            disabled={disabled}
            onClick={() => onTimeAnswerTypeChange("duration")}
          />
        </>
      ) : null}
    </div>
  );
}

function MoreMenuItem({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-normal text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {checked ? (
        <Check aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
      ) : (
        <span aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function QuestionValidationEditor({
  enabled,
  questionType,
  validationType,
  validationTextType,
  validationOperator,
  validationValue,
  validationValueMax,
  regex,
  errorMessage,
  disabled,
  onTypeChange,
  onTextTypeChange,
  onOperatorChange,
  onValueChange,
  onValueMaxChange,
  onRegexChange,
  onErrorMessageChange,
  onRemove,
}: {
  enabled: boolean;
  questionType: QuestionType;
  validationType: ValidationType;
  validationTextType: "length" | "regex";
  validationOperator: ValidationOperator;
  validationValue: number;
  validationValueMax: number;
  regex: string;
  errorMessage: string;
  disabled: boolean;
  onTypeChange: (value: ValidationType) => void;
  onTextTypeChange: (value: "length" | "regex") => void;
  onOperatorChange: (value: ValidationOperator) => void;
  onValueChange: (value: number) => void;
  onValueMaxChange: (value: number) => void;
  onRegexChange: (value: string) => void;
  onErrorMessageChange: (value: string) => void;
  onRemove: () => void;
}) {
  if (!enabled) return null;

  const isCheckbox = questionType === "multiple_choice";
  const effectiveType: ValidationType = isCheckbox
    ? "checkbox_count"
    : validationType === "checkbox_count"
      ? "length"
      : validationType;
  const ruleType: "number" | "length" | "regex" =
    effectiveType === "text" ? validationTextType : effectiveType === "number" ? "number" : effectiveType === "regex" ? "regex" : "length";
  const operatorOptions =
    effectiveType === "checkbox_count"
      ? CHECKBOX_OPERATOR_OPTIONS
      : ruleType === "number"
        ? NUMBER_OPERATOR_OPTIONS
        : LENGTH_OPERATOR_OPTIONS;
  const isRange =
    ruleType === "number" &&
    (validationOperator === "between" || validationOperator === "not_between");
  const needsNumber =
    ruleType === "length" ||
    (ruleType === "number" &&
      !["is_number", "integer"].includes(validationOperator));

  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-slate-50/80 p-2">
      {isCheckbox ? (
        <AdminSelectDropdown
          ariaLabel="선택지 응답 검증 기준"
          value={validationOperator}
          options={CHECKBOX_OPERATOR_OPTIONS}
          onChange={(value) => onOperatorChange(value as ValidationOperator)}
          disabled={disabled}
          className="w-36 shrink-0"
          buttonClassName="!h-9 !bg-white"
        />
      ) : (
        <AdminSelectDropdown
          ariaLabel="응답 검증 유형"
          value={effectiveType}
          options={VALIDATION_TYPE_OPTIONS}
          onChange={(value) => onTypeChange(value as ValidationType)}
          disabled={disabled}
          className="w-24 shrink-0"
          buttonClassName="!h-9 !bg-white"
        />
      )}
      {effectiveType === "text" ? (
        <AdminSelectDropdown
          ariaLabel="텍스트 응답 검증 유형"
          value={validationTextType}
          options={TEXT_VALIDATION_OPTIONS}
          onChange={(value) => onTextTypeChange(value as "length" | "regex")}
          disabled={disabled}
          className="w-32 shrink-0"
          buttonClassName="!h-9 !bg-white"
        />
      ) : null}
      {effectiveType === "checkbox_count" || ruleType === "number" || ruleType === "length" ? (
        <AdminSelectDropdown
          ariaLabel="응답 검증 연산자"
          value={validationOperator}
          options={operatorOptions}
          onChange={(value) => onOperatorChange(value as ValidationOperator)}
          disabled={disabled}
          className="w-36 shrink-0"
          buttonClassName="!h-9 !bg-white"
        />
      ) : null}
      {ruleType === "regex" ? (
        <UiInput
          aria-label="정규식"
          className="h-9 min-w-40 flex-1"
          placeholder="정규식 (예: ^[0-9]+$)"
          value={regex}
          disabled={disabled}
          onChange={(event) => onRegexChange(event.target.value)}
        />
      ) : needsNumber ? (
        <UiInput
          aria-label="응답 검증 숫자"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="h-9 w-24 shrink-0"
          value={validationValue}
          disabled={disabled}
          onChange={(event) => onValueChange(Number(event.target.value) || 0)}
        />
      ) : null}
      {isRange ? (
        <UiInput
          aria-label="응답 검증 두 번째 숫자"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="h-9 w-24 shrink-0"
          value={validationValueMax}
          disabled={disabled}
          onChange={(event) => onValueMaxChange(Number(event.target.value) || 0)}
        />
      ) : null}
      <UiInput
        aria-label="맞춤 오류 텍스트"
        className="h-9 min-w-40 flex-1"
        placeholder="맞춤 오류 텍스트"
        value={errorMessage}
        disabled={disabled}
        onChange={(event) => onErrorMessageChange(event.target.value)}
      />
      <IconButton
        type="button"
        size="sm"
        aria-label="응답 확인 삭제"
        disabled={disabled}
        onClick={onRemove}
        className="shrink-0 text-slate-400 hover:bg-white hover:text-slate-700"
      >
        <X aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  );
}
