import { useMemo, type SyntheticEvent } from "react";
import type { SurveyDetailResponse } from "@soc/contracts";

import {
  emptyAnswerValue,
  getLocalizedText,
  isAnswerFilled,
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
  const visibleQuestions = useMemo(
    () => visibleSections.flatMap((section) => section.questions),
    [visibleSections],
  );
  const questionNumbers = useMemo(
    () =>
      new Map(
        visibleQuestions.map((question, index) => [question.id, index + 1]),
      ),
    [visibleQuestions],
  );
  const answeredQuestionCount = visibleQuestions.filter((question) =>
    isAnswerFilled(question.questionType, answers[question.id]),
  ).length;
  const unansweredQuestionCount = Math.max(
    0,
    visibleQuestions.length - answeredQuestionCount,
  );
  const requiredUnansweredQuestionCount = visibleQuestions.filter(
    (question) =>
      question.isRequired &&
      !isAnswerFilled(question.questionType, answers[question.id]),
  ).length;
  const progressPercent = visibleQuestions.length
    ? Math.round((answeredQuestionCount / visibleQuestions.length) * 100)
    : 0;
  const questionsWithErrors = visibleQuestions.filter(
    (question) => questionErrors[question.id],
  );

  return (
    <div className="animate-in fade-in duration-300">
      {isPreview && <PreviewNoticeView lang={lang} />}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {isEditingExistingResponse && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {lang === "ko"
              ? "이전에 제출한 응답을 수정하는 중입니다. 설문이 열려 있는 동안 다시 저장할 수 있습니다."
              : "You are editing your previous response. Changes can be saved before the survey closes."}
          </div>
        )}
        <section
          aria-label={lang === "ko" ? "설문 진행 상태" : "Survey progress"}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.035)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {lang === "ko" ? "설문 진행률" : "Survey progress"}
            </p>
            <p className="text-sm font-semibold tabular-nums text-kaist-darkgreen">
              {answeredQuestionCount} / {visibleQuestions.length}
            </p>
          </div>
          <div
            aria-label={lang === "ko" ? "설문 진행률" : "Survey progress"}
            aria-valuemax={Math.max(visibleQuestions.length, 1)}
            aria-valuemin={0}
            aria-valuenow={answeredQuestionCount}
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-kaist-darkgreen transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-slate-500">
            <span>
              {unansweredQuestionCount > 0
                ? lang === "ko"
                  ? `미응답 ${unansweredQuestionCount}개`
                  : `${unansweredQuestionCount} unanswered`
                : lang === "ko"
                  ? "모든 문항에 답변했습니다."
                  : "All questions answered."}
            </span>
            {requiredUnansweredQuestionCount > 0 ? (
              <span className="font-semibold text-rose-600">
                {lang === "ko"
                  ? `필수 ${requiredUnansweredQuestionCount}개`
                  : `${requiredUnansweredQuestionCount} required`}
              </span>
            ) : null}
          </div>
          {visibleSections.length > 1 ? (
            <nav
              aria-label={lang === "ko" ? "설문 섹션 탐색" : "Survey sections"}
              className="mt-4 flex min-w-0 gap-2 overflow-x-auto border-t border-slate-100 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleSections.map((section, index) => {
                const sectionTitle = getLocalizedText(
                  lang,
                  section.titleKo,
                  section.titleEn,
                );
                return (
                  <a
                    key={section.id}
                    href={`#survey-section-${section.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-kaist-darkgreen/30 hover:bg-emerald-50 hover:text-kaist-darkgreen"
                  >
                    {sectionTitle ||
                      (lang === "ko" ? `섹션 ${index + 1}` : `Section ${index + 1}`)}
                  </a>
                );
              })}
            </nav>
          ) : null}
        </section>

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
                    <div className="bg-[#5545e8] px-5 py-3.5 text-white">
                      <h2 className="break-words text-base font-normal leading-6">
                        {sectionTitle}
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
                    <label className="block min-w-0 text-[length:var(--ui-text-section-size)] font-normal leading-6 text-slate-950">
                      <span className="min-h-6 break-words leading-6">
                        <span className="mr-1 tabular-nums text-slate-400">
                          {questionNumbers.get(question.id)}.
                        </span>
                        {getLocalizedText(
                          lang,
                          question.titleKo,
                          question.titleEn,
                        )}
                        {question.isRequired && (
                          <span className="ml-1 inline-block translate-y-[-0.22em] text-xs font-bold leading-none text-rose-500">
                            *
                          </span>
                        )}
                      </span>
                    </label>
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

        {(submitError || questionsWithErrors.length > 0) && (
          <div
            aria-live="assertive"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {submitError ? <p className="font-semibold">{submitError}</p> : null}
            {questionsWithErrors.length > 0 ? (
              <div className={submitError ? "mt-2" : undefined}>
                <p className="font-semibold">
                  {lang === "ko"
                    ? "확인이 필요한 문항"
                    : "Questions that need attention"}
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1">
                  {questionsWithErrors.map((question) => (
                    <li key={question.id}>
                      <a
                        className="font-medium underline underline-offset-2 hover:text-rose-900"
                        href={`#survey-question-${question.id}`}
                      >
                        {questionNumbers.get(question.id)}. {getLocalizedText(
                          lang,
                          question.titleKo,
                          question.titleEn,
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

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
