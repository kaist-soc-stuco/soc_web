import { useEffect, useId, useRef, useState } from "react";
import { getResponseError } from "./survey-response-validation";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getLocalizedText, isAnswerFilled, type AnswerValue } from "./survey-answer-utils";
import { SurveyQuestionInput, type ResponseQuestion } from "./survey-question-input";

export function SurveyQuestionCard({ question, value, onChange, lang, error: questionError = null, disabled = false, maxSelections, hint, id }: {
  question: ResponseQuestion; value: AnswerValue; onChange: (value: AnswerValue) => void; lang: string;
  error?: string | null; disabled?: boolean; maxSelections?: number; hint?: string; id?: string;
}) {
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const describedBy = [question.descriptionKo || question.descriptionEn ? descriptionId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const [blurError, setBlurError] = useState<string | null>(null);
  const validationVersion = useRef(0);
  useEffect(() => {
    validationVersion.current++;
    setBlurError(null);
    return () => { validationVersion.current++; };
  }, [value, question, lang, disabled]);
  const error = questionError || (!disabled && blurError) || (touched && !disabled && question.isRequired && !isAnswerFilled(question.questionType, value)
    ? lang === "ko" ? "필수 질문입니다." : "This question is required."
    : null);
  const questionImage = lang === "ko" ? question.config?.imageUrlKo : question.config?.imageUrlEn || question.config?.imageUrlKo;
  return (
    <div
      id={id ?? `survey-question-${question.id}`}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)
          && !(event.relatedTarget instanceof Element && event.relatedTarget.closest('[role="listbox"]'))) {
          setTouched(true);
          if (!disabled) {
            const version = ++validationVersion.current;
            void getResponseError(question, value, lang).then(message => {
              if (version === validationVersion.current) setBlurError(message);
            });
          }
        }
      }}
      className={`group scroll-mt-24 rounded-lg border bg-white px-5 py-4 shadow-none transition-[border-color,box-shadow] ${
        error
          ? "border-red-500 hover:border-red-500"
          : "border-slate-200 hover:border-kaist-darkgreen/20"
      } shadow-none`}
    >
      <div className="mb-3.5">
        <div id={titleId} className="block min-w-0 text-[length:var(--ui-text-section-size)] font-normal leading-6 text-slate-950">
          <span className="min-h-6 break-words leading-6">
            <RichTextContent inline content={getLocalizedText(lang, question.titleKo, question.titleEn)} />
            {question.isRequired && (
              <span className="ml-1 inline-block translate-y-[-0.22em] text-xs font-bold leading-none text-rose-500">
                *
              </span>
            )}
          </span>
        </div>
      </div>
      {question.descriptionKo || question.descriptionEn ? <div id={descriptionId}><RichTextContent content={getLocalizedText(lang, question.descriptionKo, question.descriptionEn)} className="mb-3 text-sm leading-6" /></div> : null}
      {hint ? <p id={hintId} className="mb-3 text-sm text-slate-500">{hint}</p> : null}
      {questionImage ? (
        <img
          src={resolveAssetUrl(questionImage)}
          alt=""
          className="mb-4 max-h-[28rem] w-full rounded-xl border border-slate-200 object-contain"
        />
      ) : null}
      <div>
        <SurveyQuestionInput
          question={question}
          labelledBy={titleId}
          describedBy={describedBy}
          value={value}
          onChange={onChange}
          lang={lang}
          disabled={disabled}
          maxSelections={maxSelections}
          error={error}
        />
      </div>
    </div>
  );
}
