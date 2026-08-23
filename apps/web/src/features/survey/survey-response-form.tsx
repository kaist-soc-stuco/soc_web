import type {
  SurveyDetailResponse,
  SurveyQuestionRecord,
} from "@soc/contracts";
import { CheckCircle2 } from "lucide-react";

import {
  emptyAnswerValue,
  getLocalizedText,
  type AnswerValue,
} from "./survey-answer-utils";
import { SurveyQuestionInput } from "./survey-question-input";
import { PreviewNoticeView } from "./survey-state-views";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { Button } from "@/components/ui/button";

interface SurveyResponseFormProps {
  allQuestions: SurveyQuestionRecord[];
  answers: Record<string, AnswerValue>;
  isEditingExistingResponse: boolean;
  isPreview: boolean;
  lang: string;
  onAnswerChange: (questionId: string, value: AnswerValue) => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  questionErrors: Record<string, string>;
  submitError: string | null;
  submitting: boolean;
  survey: SurveyDetailResponse;
  visibleSectionIds: Set<string>;
}

export function SurveyResponseForm({
  allQuestions,
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
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
      {isPreview && <PreviewNoticeView lang={lang} />}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {isEditingExistingResponse && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {lang === "ko"
              ? "이전에 제출한 응답을 수정하는 중입니다. 설문이 열려 있는 동안 다시 저장할 수 있습니다."
              : "You are editing your previous response. Changes can be saved before the survey closes."}
          </div>
        )}
        {survey.sections.filter((section) => visibleSectionIds.has(section.id)).map((section) => (
          <section key={section.id} className="flex flex-col gap-4">
            {(getLocalizedText(lang, section.titleKo, section.titleEn) ||
              getLocalizedText(
                lang,
                section.descriptionKo,
                section.descriptionEn,
              )) && (
              <div className="px-1 pb-1 pt-2">
                {getLocalizedText(lang, section.titleKo, section.titleEn) && (
                  <h2 className="text-base font-semibold text-slate-950">
                    {getLocalizedText(lang, section.titleKo, section.titleEn)}
                  </h2>
                )}
                {getLocalizedText(
                  lang,
                  section.descriptionKo,
                  section.descriptionEn,
                ) && (
                  <RichTextContent
                    content={getLocalizedText(
                      lang,
                      section.descriptionKo,
                      section.descriptionEn,
                    )}
                    className="mt-1.5 text-[15px] font-medium leading-relaxed text-slate-500"
                  />
                )}
              </div>
            )}

            {section.questions.map((question) => {
              const questionIndex =
                allQuestions.findIndex((item) => item.id === question.id) + 1;

              return (
                <div
                  key={question.id}
                  className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] hover:border-kaist-darkgreen/20 hover:shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                >
                  <div className="mb-3.5 border-b border-slate-100 pb-3">
                    <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[15px] font-medium leading-6 text-slate-950">
                      <span className="inline-flex h-6 shrink-0 items-center leading-6 text-kaist-darkgreen">
                        {questionIndex}.
                      </span>
                      <span className="min-h-6 break-words leading-6">
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
                  {getLocalizedText(
                    lang,
                    question.descriptionKo,
                    question.descriptionEn,
                  ) && (
                    <RichTextContent
                      content={getLocalizedText(
                        lang,
                        question.descriptionKo,
                        question.descriptionEn,
                      )}
                      className="mb-4 text-[15px] font-medium leading-relaxed text-slate-500"
                    />
                  )}
                  <div>
                    <SurveyQuestionInput
                      question={question}
                      value={
                        answers[question.id] ?? emptyAnswerValue(question.questionType)
                      }
                      onChange={(value) => onAnswerChange(question.id, value)}
                      lang={lang}
                      disabled={isPreview}
                      error={questionErrors[question.id] ?? null}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold">
            {submitError}
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button
            variant="default"
            type="submit"
            disabled={submitting || isPreview}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-kaist-darkgreen px-8 py-3.5 text-sm font-medium text-white shadow-sm shadow-kaist-darkgreen/10 transition-all hover:bg-kaist-darkgreen/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
            ) : (
              <>
                <CheckCircle2 className="w-4.5 h-4.5" />
                {isEditingExistingResponse
                  ? lang === "ko"
                    ? "수정 내용 저장하기"
                    : "Save changes"
                  : lang === "ko"
                    ? "설문 응답 제출하기"
                    : "Submit Response"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
