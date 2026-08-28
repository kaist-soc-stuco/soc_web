import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import type { SurveyDetailResponse } from "@soc/contracts";

import {
  emptyAnswerValue,
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
  onNextSection: (sectionId: string) => boolean;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  questionErrors: Record<string, string>;
  submitError: string | null;
  submitting: boolean;
  survey: SurveyDetailResponse;
  visibleSectionIds: Set<string>;
  draftRestored: boolean;
}

export function SurveyResponseForm({
  answers,
  isEditingExistingResponse,
  isPreview,
  lang,
  onAnswerChange,
  onNextSection,
  onSubmit,
  questionErrors,
  submitError,
  submitting,
  survey,
  visibleSectionIds,
  draftRestored,
}: SurveyResponseFormProps) {
  const visibleSections = useMemo(
    () => survey.sections.filter((section) => visibleSectionIds.has(section.id)),
    [survey.sections, visibleSectionIds],
  );
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    setActiveSectionId((current) =>
      current && visibleSections.some((section) => section.id === current)
        ? current
        : visibleSections[0]?.id ?? null,
    );
  }, [visibleSections]);

  const activeSectionIndex = Math.max(
    0,
    visibleSections.findIndex((section) => section.id === activeSectionId),
  );
  const activeSection = visibleSections[activeSectionIndex];
  const hasPreviousSection = activeSectionIndex > 0;
  const hasNextSection = activeSectionIndex < visibleSections.length - 1;

  const handleNext = () => {
    if (!activeSection || !onNextSection(activeSection.id)) return;
    const nextSection = visibleSections[activeSectionIndex + 1];
    if (nextSection) setActiveSectionId(nextSection.id);
  };

  const handlePrevious = () => {
    const previousSection = visibleSections[activeSectionIndex - 1];
    if (previousSection) setActiveSectionId(previousSection.id);
  };

  const handleFormSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    if (hasNextSection) {
      event.preventDefault();
      handleNext();
      return;
    }
    onSubmit(event);
  };

  return (
    <div className="animate-in fade-in duration-300">
      {isPreview && <PreviewNoticeView lang={lang} />}
      <form noValidate onSubmit={handleFormSubmit} className="flex flex-col gap-5">
        {isEditingExistingResponse && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {lang === "ko"
              ? "이전에 제출한 응답을 수정하는 중입니다. 설문이 열려 있는 동안 다시 저장할 수 있습니다."
              : "You are editing your previous response. Changes can be saved before the survey closes."}
          </div>
        )}
        {draftRestored && (
          <p
            role="status"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-normal text-slate-500"
          >
            {lang === "ko"
              ? "이전에 입력한 응답을 불러왔습니다."
              : "Your saved response has been restored."}
          </p>
        )}
        {activeSection ? (
          <section key={activeSection.id} className="flex flex-col gap-4">
            {(() => {
              const sectionTitle = getLocalizedText(
                lang,
                activeSection.titleKo,
                activeSection.titleEn,
              );
              const sectionDescription = getLocalizedText(
                lang,
                activeSection.descriptionKo,
                activeSection.descriptionEn,
              );

              if (!sectionTitle && !sectionDescription) return null;

              return (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.035)]">
                  {sectionTitle ? (
                    <div className="bg-[#5545e8] px-5 py-3.5 text-white">
                      <h2 className="text-base font-normal leading-6">
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

            {activeSection.questions.map((question) => {
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
                      className="mb-4 text-[length:var(--ui-text-section-size)] font-normal leading-relaxed text-slate-500"
                    />
                  )}
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
        ) : null}

        {submitError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            {visibleSections.length > 1 && (
              <span className="text-xs font-normal text-slate-500">
                {activeSectionIndex + 1} / {visibleSections.length}
              </span>
            )}
            {hasPreviousSection && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                className="rounded-xl px-5 py-3 text-sm font-medium"
              >
                {lang === "ko" ? "이전" : "Back"}
              </Button>
            )}
          </div>
          <Button
            variant="default"
            type="submit"
            disabled={submitting || (isPreview && !hasNextSection)}
            className="inline-flex w-full items-center justify-center rounded-xl border-0 bg-kaist-darkgreen px-8 py-3.5 text-sm !font-medium text-white shadow-sm shadow-kaist-darkgreen/10 transition-all hover:bg-kaist-darkgreen/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
            ) : hasNextSection ? (
              lang === "ko" ? "다음" : "Next"
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
