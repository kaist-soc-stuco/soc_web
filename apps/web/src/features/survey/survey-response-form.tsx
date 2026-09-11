import { useMemo, type SyntheticEvent } from "react";
import type { SurveyDetailResponse } from "@soc/contracts";

import {
  emptyAnswerValue,
  isAnswerFilled,
  getLocalizedText,
  type AnswerValue,
} from "./survey-answer-utils";
import { SurveyQuestionInput } from "./survey-question-input";
import { PreviewNoticeView } from "./survey-state-views";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/asset-url";

interface SurveyResponseFormProps {
  answers: Record<string, AnswerValue>;
  isEditingExistingResponse: boolean;
  isPreview: boolean;
  lang: string;
  onAnswerChange: (questionId: string, value: AnswerValue) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  questionErrors: Record<string, string>;
  submitError: string | null;
  submitting: boolean;
  survey: SurveyDetailResponse;
  visibleSectionIds: Set<string>;
}

export function SurveyResponseForm({
  answers,
  isEditingExistingResponse,
  isPreview,
  lang,
  onAnswerChange,
  onSubmit,
  questionErrors,
  submitError,
  submitting,
  survey,
  visibleSectionIds,
}: SurveyResponseFormProps) {
  const visibleSections = useMemo(
    () => survey.sections.filter((section) => visibleSectionIds.has(section.id)),
    [survey.sections, visibleSectionIds],
  );

  const visibleQuestions = visibleSections.flatMap((section) => section.questions);
  const answeredQuestionCount = visibleQuestions.filter((question) => isAnswerFilled(question.questionType, answers[question.id])).length;

  return (
    <div className="animate-in fade-in duration-300">

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {isEditingExistingResponse && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {lang === "ko"
              ? "이전에 제출한 응답을 수정하는 중입니다. 설문이 열려 있는 동안 다시 저장할 수 있습니다."
              : "You are editing your previous response. Changes can be saved before the survey closes."}
          </div>
        )}


        {visibleSections.map((section) => (
          <section
            key={section.id}
            id={`survey-section-${section.id}`}
            className="flex scroll-mt-24 flex-col gap-4"
          >
            {(() => {
              const sectionTitle = getLocalizedText(
                lang,
                section.titleKo,
                section.titleEn,
              );
              const sectionDescription = getLocalizedText(
                lang,
                section.descriptionKo,
                section.descriptionEn,
              );

              if (!sectionTitle && !sectionDescription) return null;

              return (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.035)]">
                  {sectionTitle ? (
                    <div className="bg-brand-primary px-5 py-3.5 text-white">
                      <h2 className="break-words text-base font-normal leading-6">
                        <RichTextContent content={sectionTitle} />
                      </h2>
                    </div>
                  ) : null}
                  {sectionDescription ? (
                    <RichTextContent
                      content={sectionDescription}
                      className="px-5 py-4 text-[length:var(--ui-text-section-size)] font-normal leading-relaxed text-slate-600"
                    />
                  ) : null}
                </div>
                );
            })()}

            {section.questions.map((question) => {
              const questionError = questionErrors[question.id] ?? null;
              const questionImage = lang === "ko"
                ? question.config?.imageUrlKo
                : question.config?.imageUrlEn || question.config?.imageUrlKo;

              return (
                <div
                  key={question.id}
                  id={`survey-question-${question.id}`}
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
                      value={
                        answers[question.id] ?? emptyAnswerValue(question.questionType)
                      }
                      onChange={(value) => onAnswerChange(question.id, value)}
                      lang={lang}
                      disabled={isPreview}
                      error={questionError}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {submitError ? <p role="alert" className="text-sm text-rose-700">{submitError}</p> : null}

        <div className="survey-response-actions flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-0 py-3 md:border-t-0 md:py-0">
          <span className="mr-auto text-xs font-normal tabular-nums text-slate-500">
            {lang === "ko"
              ? `응답 ${answeredQuestionCount}/${visibleQuestions.length}`
              : `${answeredQuestionCount}/${visibleQuestions.length} answered`}
          </span>
          <Button
            variant="default"
            type="submit"
            disabled={submitting || isPreview}
            className="inline-flex min-h-11 w-auto items-center justify-center rounded-xl border-0 bg-kaist-darkgreen px-8 py-3.5 text-sm !font-medium text-white shadow-sm shadow-kaist-darkgreen/10 transition-all hover:bg-kaist-darkgreen/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {lang === "ko" ? "제출 중..." : "Submitting..."}
              </>
            ) : isEditingExistingResponse ? (
              lang === "ko" ? "저장" : "Save"
            ) : (
              lang === "ko" ? "제출" : "Submit"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
