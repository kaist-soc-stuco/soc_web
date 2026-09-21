import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  QuestionOption,
  QuestionType,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { CircleAlert, Check, FileText, Heart, Loader2, Plus, Star, ThumbsUp, UploadCloud, X } from "lucide-react";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import { useToast } from "@/components/ui/toast";
import { useCurrentSession } from "@/hooks/use-current-session";

import type { AnswerValue, FileAnswer } from "./survey-answer-utils";
import { UiInput, UiTextarea } from "@/components/ui/form-control";

export type ResponseQuestion = Pick<SurveyQuestionRecord, "id" | "questionType" | "options" | "config" | "titleKo" | "titleEn" | "descriptionKo" | "descriptionEn" | "isRequired"> & Partial<Pick<SurveyQuestionRecord, "answerRegex">>;

interface QuestionInputProps {
  maxSelections?: number;
  disabled?: boolean;
  error?: string | null;
  lang: string;
  onChange: (v: AnswerValue) => void;
  question: ResponseQuestion;
  value: AnswerValue;
}

function normalizeDatetimeLocalValue(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 16);
  }
  return "";
}

export function SurveyQuestionInput({
  question,
  value,
  onChange,
  lang,
  disabled = false,
  error = null,
  maxSelections,
}: QuestionInputProps) {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { toast } = useToast();
  const { data: session } = useCurrentSession();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const base =
    "survey-answer-control min-h-11 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-base outline-none transition-[border-color,box-shadow] placeholder:text-[length:var(--ui-text-body-size)] placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-slate-300 focus:border-kaist-darkgreen focus:ring-0 md:text-sm";
  const controlClass = base;
  const renderError = error ? (
    <p className="mb-2 mt-5 flex items-center gap-3 text-sm font-normal text-red-500" role="alert">
      <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null;

  const getOptionLabel = (opt: QuestionOption) => {
    return lang === "ko" ? opt.labelKo : opt.labelEn || opt.labelKo;
  };
  const getOptionImage = (opt: QuestionOption) =>
    lang === "ko" ? opt.imageUrlKo : opt.imageUrlEn || opt.imageUrlKo;
  const displayedOptions = useMemo(() => {
    const options = question.options ?? [];
    if (!question.config?.shuffleOptions || options.length < 2) return options;
    const shuffled = [...options];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }, [question.config?.shuffleOptions, question.options]);

  switch (question.questionType as QuestionType) {
    case "short_text":
      return (
        <div>
          <UiInput
            className={`${controlClass} !w-1/2`}
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            placeholder={lang === "ko" ? "내 답변" : "My answer"}
          />
          {renderError}
        </div>
      );

    case "long_text":
      return (
        <div>
          <UiTextarea
            rows={1}
            className={`${controlClass} min-h-11 leading-normal resize-none`}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            placeholder={lang === "ko" ? "내 답변" : "My answer"}
          />
          {renderError}
        </div>
      );

    case "single_choice":
    case "dropdown":
      if (question.questionType === "dropdown") {
        return (
          <div>
            <SelectDropdown
              value={value as string}
              onChange={onChange}
              disabled={disabled}
              ariaInvalid={Boolean(error)}
              options={[
                {
                  value: "",
                  label: lang === "ko" ? "선택" : "Select",
                },
                ...displayedOptions.map((opt, index) => ({
                  value: opt.value,
                  label: getOptionLabel(opt),
                  separatorBefore: index === 0,
                })),
              ]}
              className="w-full max-w-xs"
              buttonClassName="!h-11 !min-h-11 !rounded-lg !border !border-slate-200 !bg-white !px-3.5 text-left !shadow-none hover:!border-slate-300 hover:!bg-slate-50"
              menuClassName="animate-in fade-in zoom-in-95 duration-150 rounded-xl border-gray-200 opacity-100"
              emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
            />
            {renderError}
          </div>
        );
      }
      return (
        <div>
          <div className="flex flex-col gap-2.5">
          {displayedOptions.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 py-2 transition-colors ${
                  isSelected
                    ? "text-kaist-black"
                    : "text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`relative box-border size-5 shrink-0 rounded-full border-2 ${
                    isSelected
                      ? "border-kaist-darkgreen bg-white"
                      : "border-kaist-grey/30"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-kaist-darkgreen" />
                  )}
                </div>
                <UiInput
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => onChange(opt.value)}
                  disabled={disabled}
                  className="hidden"
                />
                <span className="min-w-0 break-words text-[length:var(--ui-text-body-size)] leading-5">
                  {getOptionLabel(opt)}
                </span>
                {getOptionImage(opt) ? (
                  <img src={resolveAssetUrl(getOptionImage(opt)!)} alt="" className="ml-auto max-h-28 max-w-40 rounded-lg object-contain" />
                ) : null}
              </label>
            );
          })}
          </div>
          {renderError}
        </div>
      );

    case "multiple_choice":
      return (
        <div>
          <div className="flex flex-col gap-2.5">
          {displayedOptions.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            const optionDisabled = disabled || (!selected && maxSelections !== undefined && (value as string[]).length >= maxSelections);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 py-2 transition-colors ${optionDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                  selected
                    ? "text-kaist-black"
                    : "text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                    selected
                      ? "border-kaist-darkgreen bg-kaist-darkgreen"
                      : "border-kaist-grey/30"
                  }`}
                >
                  {selected && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  value={opt.value}
                  checked={selected}
                  onChange={() => {
                    if (optionDisabled) return;
                    const prev = value as string[];
                    onChange(
                      selected
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value],
                    );
                  }}
                  disabled={optionDisabled}
                  className="hidden"
                />
                <span className="min-w-0 break-words text-[length:var(--ui-text-body-size)] leading-5">
                  {getOptionLabel(opt)}
                </span>
                {getOptionImage(opt) ? (
                  <img src={resolveAssetUrl(getOptionImage(opt)!)} alt="" className="ml-auto max-h-28 max-w-40 rounded-lg object-contain" />
                ) : null}
              </label>
            );
          })}
          </div>
          {renderError}
        </div>
      );

    case "rating": {
      const configuredMax = Number(question.config?.ratingMax ?? 5);
      const max = Number.isInteger(configuredMax)
        ? Math.min(Math.max(configuredMax, 3), 10)
        : 5;
      const selectedRating = typeof value === "string" ? Number(value) : Number.NaN;
      const RatingIcon =
        question.config?.ratingIcon === "heart"
          ? Heart
          : question.config?.ratingIcon === "thumbs_up"
            ? ThumbsUp
            : Star;

      return (
        <div>
          <fieldset className="w-full">
            <legend className="sr-only">
              {lang === "ko" ? "등급을 선택하세요" : "Choose a rating"}
            </legend>
            <div className="mx-auto flex max-w-lg items-start justify-between gap-3 px-2">
              {Array.from({ length: max }, (_, index) => {
                const rating = index + 1;
                const selected = selectedRating === rating;
                return (
                  <button
                    key={rating}
                    type="button"
                    aria-label={lang === "ko" ? `${rating}점` : `${rating} stars`}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onChange(String(rating))}
                    className="group flex min-w-10 flex-col items-center gap-2 rounded-lg px-2 py-1 text-sm font-normal text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="leading-5">{rating}</span>
                    <RatingIcon
                      aria-hidden="true"
                      className={`size-6 transition-colors ${rating <= selectedRating ? "fill-amber-400 text-amber-400" : "text-slate-500 group-hover:text-slate-700"}`}
                      strokeWidth={1.8}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>
          {renderError}
        </div>
      );
    }

    case "grid_single":
    case "grid_multiple": {
      const gridValue =
        typeof value === "object" && value !== null && "kind" in value && value.kind === "grid"
          ? value.values
          : {};
      const rows = question.config?.rows ?? [];
      const columns = question.config?.columns ?? [];
      const isMultiple = question.questionType === "grid_multiple";
      const updateGrid = (rowValue: string, columnValue: string) => {
        const current = gridValue[rowValue];
        if (isMultiple) {
          const currentValues = Array.isArray(current) ? current : [];
          const nextValues = currentValues.includes(columnValue)
            ? currentValues.filter((item) => item !== columnValue)
            : [...currentValues, columnValue];
          onChange({
            kind: "grid",
            values: { ...gridValue, [rowValue]: nextValues },
          });
          return;
        }
        onChange({ kind: "grid", values: { ...gridValue, [rowValue]: columnValue } });
      };

      const gridStyle = {
        "--survey-grid-column-count": Math.max(columns.length, 1),
      } as CSSProperties;

      return (
        <div
          className="survey-grid rounded-xl border border-slate-200"
          style={gridStyle}
        >
          <div className="survey-grid__header bg-slate-50 text-xs font-bold text-slate-500">
            <span className="survey-grid__row-label px-3 py-3 pr-1 text-left">
              항목
            </span>
            <div className="survey-grid__column-list">
              {columns.map((column) => (
                <span
                  key={column.value}
                  className="survey-grid__column-label px-2 py-3 text-center"
                >
                  {getOptionLabel(column)}
                </span>
              ))}
            </div>
          </div>
          <div className="survey-grid__body divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.value} role="group" aria-label={getOptionLabel(row)} className="survey-grid__row">
                <div className="survey-grid__row-label px-3 py-3 pr-1 text-left font-medium text-slate-700">
                  {getOptionLabel(row)}
                </div>
                <div className="survey-grid__options">
                  {columns.map((column) => {
                    const selected = isMultiple
                      ? Array.isArray(gridValue[row.value]) &&
                        gridValue[row.value].includes(column.value)
                      : gridValue[row.value] === column.value;
                    return (
                      <label
                        key={column.value}
                        className="survey-grid__option border-transparent"
                      >
                        <UiInput
                          type={isMultiple ? "checkbox" : "radio"}
                          name={
                            isMultiple
                              ? `${question.id}-${row.value}-${column.value}`
                              : `${question.id}-${row.value}`
                          }
                          checked={selected}
                          onChange={() => updateGrid(row.value, column.value)}
                          disabled={disabled}
                          className="size-4 shrink-0 accent-kaist-darkgreen focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/30"
                          aria-label={`${getOptionLabel(row)} - ${getOptionLabel(column)}`}
                        />
                        <span className="survey-grid__option-label">
                          {getOptionLabel(column)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {renderError}
        </div>
      );
    }

    case "file_upload": {
      if (!session?.userId) {
        return <p className="text-sm text-slate-500">{lang === "ko"
          ? "파일 첨부는 로그인 후 이용할 수 있습니다. 자료 링크 입력란이 있다면 공유 링크를 입력해 주세요."
          : "Sign in to attach files. If a material-link field is available, you can provide a shared link there."}</p>;
      }
      const maxSizeBytes = question.config?.maxSizeBytes ?? 20_000_000;
      const maxFiles = question.config?.maxFiles ?? 1;
      const accept = question.config?.allowedMimeTypes?.join(",") || undefined;
      const currentFiles =
        typeof value === "object" && value !== null && "kind" in value && value.kind === "file" && Array.isArray(value.files)
          ? value.files
          : [];
      const handleFileChange = async (fileList: FileList | undefined) => {
        const selectedFiles = Array.from(fileList ?? []);
        if (selectedFiles.length === 0) return;
        if (currentFiles.length + selectedFiles.length > maxFiles) {
          toast({ type: "error", message: `파일은 최대 ${maxFiles}개까지 업로드할 수 있습니다.` });
          return;
        }
        const invalidSize = selectedFiles.find((file) => file.size > maxSizeBytes);
        if (invalidSize) {
          toast({
            type: "error",
            message: `파일은 ${(maxSizeBytes / 1_000_000).toFixed(0)}MB 이하만 업로드할 수 있습니다.`,
          });
          return;
        }
        if (question.config?.allowedMimeTypes?.length && selectedFiles.some((file) => !question.config?.allowedMimeTypes?.includes(file.type))) {
          toast({ type: "error", message: "허용되지 않은 파일 형식입니다." });
          return;
        }
        setUploading(true);
        try {
          const uploadedFiles = await Promise.all(
            selectedFiles.map(async (file): Promise<FileAnswer> => {
              const asset = await apiClient.uploadAsset(file, { transport: "server" });
              return {
                assetId: asset.assetId,
                fileName: asset.originalFilename,
                sizeBytes: asset.sizeBytes,
                mimeType: asset.mimeType,
              };
            }),
          );
          onChange({ kind: "file", files: [...currentFiles, ...uploadedFiles] });
        } catch {
          toast({ type: "error", message: "파일 업로드에 실패했습니다." });
        } finally {
          setUploading(false);
        }
      };
      const removeFile = (assetId: string) => {
        onChange({ kind: "file", files: currentFiles.filter((file) => file.assetId !== assetId) });
      };
      const openFilePicker = () => {
        if (disabled || uploading) return;
        fileInputRef.current?.click();
      };
      const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragActive(false);
        if (disabled || uploading) return;
        void handleFileChange(event.dataTransfer.files);
      };
      return (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={disabled || uploading ? -1 : 0}
            aria-disabled={disabled || uploading}
            aria-invalid={Boolean(error)}
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFilePicker();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!disabled && !uploading) setIsDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled && !uploading) setIsDragActive(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragActive(false);
              }
            }}
            onDrop={handleDrop}
            className={`flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/20 ${
              isDragActive
                ? "border-kaist-darkgreen bg-emerald-50/70"
                : "border-slate-300 bg-slate-50/70 hover:border-kaist-darkgreen/50 hover:bg-slate-50"
            } ${disabled || uploading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <UiInput
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={maxFiles > 1}
              disabled={disabled || uploading}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                void handleFileChange(event.currentTarget.files ?? undefined);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
            {uploading ? (
              <Loader2 aria-hidden="true" className="mb-2 size-7 animate-spin text-kaist-darkgreen" />
            ) : (
              <UploadCloud aria-hidden="true" className="mb-2 size-7 text-kaist-darkgreen/70" />
            )}
            <p className="text-sm font-medium text-slate-700">
              {uploading
                ? "파일을 업로드하는 중입니다."
                : currentFiles.length > 0
                  ? "파일을 추가하려면 클릭하거나 끌어다 놓으세요."
                  : "파일을 선택하거나 여기로 끌어다 놓으세요."}
            </p>
            <p className="mt-1 text-xs font-normal text-slate-400">
              최대 {(maxSizeBytes / 1_000_000).toFixed(0)}MB
            </p>
          </div>

          {currentFiles.length > 0 ? (
            <div className="space-y-2" aria-label="업로드된 파일 목록">
              {currentFiles.map((file) => (
                <div key={file.assetId} className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 break-words">{file.fileName}</span>
                  {typeof file.sizeBytes === "number" ? <span className="shrink-0 text-xs text-slate-400">{(file.sizeBytes / 1_000_000).toFixed(1)}MB</span> : null}
                  <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => removeFile(file.assetId)} disabled={disabled || uploading} aria-label={`${file.fileName} 삭제`} data-tooltip="파일 삭제">
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {maxFiles > 1 && currentFiles.length > 0 && currentFiles.length < maxFiles ? (
            <button
              type="button"
              onClick={openFilePicker}
              disabled={disabled || uploading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-kaist-darkgreen transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              파일 추가
            </button>
          ) : null}

          {renderError}
        </div>
      );
    }

    case "date": {
      const includeTime = question.config?.dateIncludeTime ?? false;
      const includeYear = question.config?.dateIncludeYear ?? true;
      const rawValue = value as string;
      const inputValue = includeTime
        ? normalizeDatetimeLocalValue(rawValue)
        : !includeYear && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
          ? rawValue.slice(5)
          : rawValue;
      return (
        <div>
          <UiInput
            className={`${controlClass} !w-auto max-w-full`}
            type={includeTime ? "datetime-local" : includeYear ? "date" : "text"}
            inputMode={!includeYear && !includeTime ? "numeric" : undefined}
            pattern={!includeYear && !includeTime ? "\\d{2}-\\d{2}" : undefined}
            placeholder={!includeYear && !includeTime ? "MM-DD" : undefined}
            value={inputValue}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
          />
          {renderError}
        </div>
      );
    }

    case "time": {
      const isDuration = question.config?.timeAnswerType === "duration";
      return (
        <div>
          <UiInput
            className={`${controlClass} !w-auto max-w-full`}
            type={isDuration ? "text" : "time"}
            inputMode={isDuration ? "numeric" : undefined}
            pattern={isDuration ? "\\d{1,3}:[0-5]\\d(?::[0-5]\\d)?" : undefined}
            placeholder={isDuration ? "예: 1:30" : undefined}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
          />
          {renderError}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-red-500">
          {lang === "ko"
            ? "지원하지 않는 질문 형식입니다."
            : "Unsupported question type."}
        </p>
      );
  }
}
