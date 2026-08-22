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
}: QuestionInputProps) {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const base =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300";

  const getOptionLabel = (opt: QuestionOption) => {
    return lang === "ko" ? opt.labelKo : opt.labelEn || opt.labelKo;
  };

  switch (question.questionType as QuestionType) {
    case "short_text":
      return (
        <UiInput
          className={base}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
          placeholder={
            lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
          }
        />
      );

    case "long_text":
      return (
        <UiTextarea
          className={`${base} min-h-[100px] resize-y`}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
          placeholder={
            lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
          }
        />
      );

    case "single_choice":
    case "dropdown":
      if (question.questionType === "dropdown") {
        return (
          <SelectDropdown
            value={value as string}
            onChange={onChange}
            disabled={disabled}
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
            buttonClassName={`${base} justify-between text-left`}
            menuClassName="rounded-xl border-gray-200"
            emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
          />
        );
      }
      return (
        <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
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
                <span className="text-sm leading-none">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
        </div>
      );

    case "multiple_choice":
      return (
        <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  selected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
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
                <span className="text-sm leading-none">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
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
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="min-w-[180px] border-b border-slate-200 px-4 py-3 text-left">항목</th>
                {columns.map((column) => (
                  <th key={column.value} className="min-w-[100px] border-b border-slate-200 px-3 py-3 text-center">
                    {getOptionLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.value}>
                  <th className="border-r border-slate-100 px-4 py-3 text-left font-bold text-slate-700">{getOptionLabel(row)}</th>
                  {columns.map((column) => {
                    const selected = isMultiple
                      ? Array.isArray(gridValue[row.value]) && gridValue[row.value].includes(column.value)
                      : gridValue[row.value] === column.value;
                    return (
                      <td key={column.value} className="px-3 py-3 text-center">
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
        </div>
      );
    }

    case "file_upload": {
      const fileValue =
        typeof value === "object" && value !== null && "kind" in value && value.kind === "file"
          ? value.file
          : null;
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
        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <UiInput
            type="file"
            accept={accept}
            disabled={disabled || uploading}
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
            className="block w-full text-sm font-semibold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-kaist-darkgreen file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-kaist-darkgreen/90"
          />
          {uploading && <p className="text-xs font-bold text-kaist-darkgreen">파일을 업로드하는 중입니다…</p>}
          {fileValue && <p className="text-xs font-bold text-slate-700">첨부됨: {fileValue.fileName}</p>}
          {uploadError && <p className="text-xs font-bold text-rose-600">{uploadError}</p>}
        </div>
      );
    }

    case "date":
      return (
        <UiInput
          className={base}
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
      );

    case "time":
      return (
        <UiInput
          className={base}
          type="time"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
      );

    case "datetime":
      return (
        <UiInput
          className={base}
          type="datetime-local"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
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
