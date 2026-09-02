import { useMemo, useRef, useState, type DragEvent } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  QuestionOption,
  QuestionType,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { Check, FileText, Loader2, Plus, Star, UploadCloud, X } from "lucide-react";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";

import type { AnswerValue, FileAnswer } from "./survey-answer-utils";
import { UiInput, UiTextarea } from "@/components/ui/form-control";

interface QuestionInputProps {
  disabled?: boolean;
  error?: string | null;
  lang: string;
  onChange: (v: AnswerValue) => void;
  question: SurveyQuestionRecord;
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
}: QuestionInputProps) {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const base =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-[length:var(--ui-text-body-size)] placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-slate-300 focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/20";
  const controlClass = base;
  const renderError = error ? (
    <p className="mt-1 text-xs font-normal text-rose-600" role="alert">
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
            className={controlClass}
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            placeholder={
              lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
            }
          />
          {renderError}
        </div>
      );

    case "long_text":
      return (
        <div>
          <UiTextarea
            autoResize={false}
            className={`${controlClass} min-h-[100px] resize-y`}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            placeholder={
              lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
            }
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
                  label: lang === "ko" ? "선택하세요" : "Select an option",
                },
                ...displayedOptions.map((opt) => ({
                  value: opt.value,
                  label: getOptionLabel(opt),
                })),
              ]}
              className="w-full"
              buttonClassName={`${controlClass} justify-between text-left`}
              menuClassName="rounded-xl border-gray-200"
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
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3.5 transition-colors ${
                  isSelected
                    ? "bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold"
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
                <span className="text-[length:var(--ui-text-body-size)] leading-5">
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
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3.5 transition-colors ${
                  selected
                    ? "bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold"
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
                    if (disabled) return;
                    const prev = value as string[];
                    onChange(
                      selected
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value],
                    );
                  }}
                  disabled={disabled}
                  className="hidden"
                />
                <span className="text-[length:var(--ui-text-body-size)] leading-5">
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
        ? Math.min(Math.max(configuredMax, 2), 10)
        : 5;
      const selectedRating = typeof value === "string" ? Number(value) : Number.NaN;

      return (
        <div>
          <fieldset className="w-full">
            <legend className="sr-only">
              {lang === "ko" ? "등급을 선택하세요" : "Choose a rating"}
            </legend>
            <div className="flex max-w-lg items-start justify-between gap-3 px-2">
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
                    <Star
                      aria-hidden="true"
                      className={`size-7 transition-colors ${selected ? "fill-amber-400 text-amber-400" : "text-slate-500 group-hover:text-slate-700"}`}
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

      return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="w-[28%] min-w-[140px] border-b border-slate-200 px-3 py-3 pr-1 text-left">항목</th>
                {columns.map((column) => (
                  <th key={column.value} className="min-w-[96px] border-b border-slate-200 px-2 py-3 text-center">
                    {getOptionLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.value}>
                  <th className="border-r border-slate-100 px-3 py-3 pr-1 text-left font-medium text-slate-700">{getOptionLabel(row)}</th>
                  {columns.map((column) => {
                    const selected = isMultiple
                      ? Array.isArray(gridValue[row.value]) && gridValue[row.value].includes(column.value)
                      : gridValue[row.value] === column.value;
                    return (
                      <td key={column.value} className="px-2 py-3 text-center">
                        <UiInput
                          type={isMultiple ? "checkbox" : "radio"}
                          name={isMultiple ? `${question.id}-${row.value}-${column.value}` : `${question.id}-${row.value}`}
                          checked={selected}
                          onChange={() => updateGrid(row.value, column.value)}
                          disabled={disabled}
                          className="h-4 w-4 accent-kaist-darkgreen focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/30"
                          aria-label={`${getOptionLabel(row)} - ${getOptionLabel(column)}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {renderError}
        </div>
      );
    }

    case "file_upload": {
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
          setUploadError(`파일은 최대 ${maxFiles}개까지 업로드할 수 있습니다.`);
          return;
        }
        const invalidSize = selectedFiles.find((file) => file.size > maxSizeBytes);
        if (invalidSize) {
          setUploadError(`파일은 ${(maxSizeBytes / 1_000_000).toFixed(0)}MB 이하만 업로드할 수 있습니다.`);
          return;
        }
        if (question.config?.allowedMimeTypes?.length && selectedFiles.some((file) => !question.config?.allowedMimeTypes?.includes(file.type))) {
          setUploadError("허용되지 않은 파일 형식입니다.");
          return;
        }
        setUploadError(null);
        setUploading(true);
        try {
          const uploadedFiles = await Promise.all(
            selectedFiles.map(async (file): Promise<FileAnswer> => {
              const asset = await apiClient.uploadAsset(file);
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
          setUploadError("파일 업로드에 실패했습니다. 다시 시도해 주세요.");
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
            aria-invalid={Boolean(error || uploadError)}
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
                <div key={file.assetId} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                  {typeof file.sizeBytes === "number" ? <span className="shrink-0 text-xs text-slate-400">{(file.sizeBytes / 1_000_000).toFixed(1)}MB</span> : null}
                  <button type="button" className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => removeFile(file.assetId)} disabled={disabled || uploading} aria-label={`${file.fileName} 삭제`}>
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
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-kaist-darkgreen transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              파일 추가
            </button>
          ) : null}

          {uploadError ? <p className="text-xs font-normal text-rose-600" role="alert">{uploadError}</p> : null}
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
            className={controlClass}
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
            className={controlClass}
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

    case "datetime":
      return (
        <div>
          <UiInput
            className={controlClass}
            type="datetime-local"
            value={normalizeDatetimeLocalValue(value)}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
          />
          {renderError}
        </div>
      );

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
