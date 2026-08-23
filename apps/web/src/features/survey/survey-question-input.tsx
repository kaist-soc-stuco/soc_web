import { useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  QuestionOption,
  QuestionType,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { Check } from "lucide-react";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

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
  const base =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-[14px] placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-slate-300 focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/20";
  const controlClass = `${base}${error ? " border-rose-500 ring-2 ring-rose-500/20" : ""}`;
  const renderError = error ? (
    <p className="mt-1 text-xs font-normal text-rose-600" role="alert">
      {error}
    </p>
  ) : null;

  const getOptionLabel = (opt: QuestionOption) => {
    return lang === "ko" ? opt.labelKo : opt.labelEn || opt.labelKo;
  };

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
                ...(question.options ?? []).map((opt) => ({
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
        <div className={error ? "rounded-xl border border-rose-500 p-2 ring-2 ring-rose-500/20" : ""}>
          <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 ${
                  isSelected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? "border-kaist-darkgreen bg-white"
                      : "border-kaist-grey/30"
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-kaist-darkgreen" />
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
                <span className="text-[14px] leading-5">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
          </div>
          {renderError}
        </div>
      );

    case "multiple_choice":
      return (
        <div className={error ? "rounded-xl border border-rose-500 p-2 ring-2 ring-rose-500/20" : ""}>
          <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 ${
                  selected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
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
                <span className="text-[14px] leading-5">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
          </div>
          {renderError}
        </div>
      );

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
        <div className={error ? "overflow-x-auto rounded-xl border border-rose-500 p-1 ring-2 ring-rose-500/20" : "overflow-x-auto rounded-xl border border-slate-200"}>
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
      const accept = question.config?.allowedMimeTypes?.join(",") || undefined;
      const handleFileChange = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > maxSizeBytes) {
          setUploadError(`파일은 ${(maxSizeBytes / 1_000_000).toFixed(0)}MB 이하만 업로드할 수 있습니다.`);
          return;
        }
        if (question.config?.allowedMimeTypes?.length && !question.config.allowedMimeTypes.includes(file.type)) {
          setUploadError("허용되지 않은 파일 형식입니다.");
          return;
        }
        setUploadError(null);
        setUploading(true);
        try {
          const asset = await apiClient.uploadAsset(file);
          const nextFile: FileAnswer = {
            assetId: asset.assetId,
            fileName: asset.originalFilename,
            sizeBytes: asset.sizeBytes,
            mimeType: asset.mimeType,
          };
          onChange({ kind: "file", file: nextFile });
        } catch {
          setUploadError("파일 업로드에 실패했습니다. 다시 시도해 주세요.");
        } finally {
          setUploading(false);
        }
      };
      return (
        <div className={`space-y-2 rounded-xl border border-dashed bg-slate-50/70 p-4 ${error ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-300"}`}>
          <UiInput
            type="file"
            accept={accept}
            disabled={disabled || uploading}
            aria-invalid={Boolean(error)}
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
            className="block w-full text-sm font-semibold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-kaist-darkgreen file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-kaist-darkgreen/90"
          />
          {uploadError ? <p className="text-xs font-normal text-rose-600" role="alert">{uploadError}</p> : null}
          {renderError}
        </div>
      );
    }

    case "date":
      return (
        <div>
          <UiInput
            className={controlClass}
            type="date"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
          />
          {renderError}
        </div>
      );

    case "time":
      return (
        <div>
          <UiInput
            className={controlClass}
            type="time"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            disabled={disabled}
          />
          {renderError}
        </div>
      );

    case "datetime":
      return (
        <div>
          <UiInput
            className={controlClass}
            type="datetime-local"
            value={value as string}
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
