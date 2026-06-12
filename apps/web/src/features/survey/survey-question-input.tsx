import type {
  QuestionOption,
  QuestionType,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { Check } from "lucide-react";

import { SelectDropdown } from "@/components/atoms/select-dropdown";

import type { AnswerValue } from "./survey-answer-utils";

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
  const base =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300";

  const getOptionLabel = (opt: QuestionOption) => {
    return lang === "ko" ? opt.labelKo : opt.labelEn || opt.labelKo;
  };

  switch (question.questionType as QuestionType) {
    case "short_text":
      return (
        <input
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
        <textarea
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
                <input
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
                <input
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

    case "date":
      return (
        <input
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
        <input
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
        <input
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
