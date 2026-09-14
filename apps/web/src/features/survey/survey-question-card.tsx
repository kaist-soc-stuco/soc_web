import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getLocalizedText, type AnswerValue } from "./survey-answer-utils";
import { SurveyQuestionInput, type ResponseQuestion } from "./survey-question-input";

export function SurveyQuestionCard({ question, value, onChange, lang, error: questionError = null, disabled = false, maxSelections, hint, id }: {
  question: ResponseQuestion; value: AnswerValue; onChange: (value: AnswerValue) => void; lang: string;
  error?: string | null; disabled?: boolean; maxSelections?: number; hint?: string; id?: string;
}) {
  const questionImage = lang === "ko" ? question.config?.imageUrlKo : question.config?.imageUrlEn || question.config?.imageUrlKo;
  return (
    <div
      id={id ?? `survey-question-${question.id}`}
      className={`group scroll-mt-24 rounded-2xl border bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.035)] transition-[border-color,box-shadow] ${
        questionError
          ? "border-rose-300 bg-rose-50/10 hover:border-rose-400"
          : "border-slate-200 hover:border-kaist-darkgreen/20"
      } hover:shadow-[0_2px_5px_rgba(15,23,42,0.045)]`}
    >
      <div className="mb-3.5">
        <div className="block min-w-0 text-[length:var(--ui-text-section-size)] font-normal leading-6 text-slate-950">
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
      {question.descriptionKo || question.descriptionEn ? <RichTextContent content={getLocalizedText(lang, question.descriptionKo, question.descriptionEn)} className="mb-3 text-sm leading-6" /> : null}
      {hint ? <p className="mb-3 text-sm text-slate-500">{hint}</p> : null}
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
          value={value}
          onChange={onChange}
          lang={lang}
          disabled={disabled}
          maxSelections={maxSelections}
          error={questionError}
        />
      </div>
    </div>
  );
}
