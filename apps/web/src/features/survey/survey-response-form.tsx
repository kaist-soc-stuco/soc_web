import { useMemo, useState, useEffect, type SyntheticEvent } from "react";
import { isSurveyDisplayBlock, type SurveyDetailResponse } from "@soc/contracts";

import {
  emptyAnswerValue,
  getLocalizedText,
  type AnswerValue,
} from "./survey-answer-utils";
import { SurveyQuestionCard } from "./survey-question-card";

import { RichTextContent } from "@/components/ui/rich-text-content";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/asset-url";

interface SurveyResponseFormProps {
  answers: Record<string, AnswerValue>;
  isEditingExistingResponse: boolean;
  isPreview: boolean;
  lang: string;
  onAnswerChange: (questionId: string, value: AnswerValue) => void;
  onClear: () => void;
  onValidate: (questions: SurveyDetailResponse["sections"][number]["questions"]) => boolean;
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
  onClear,
  onValidate,
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

  const [sectionIndex, setSectionIndex] = useState(0);
  const activeIndex = Math.min(sectionIndex, Math.max(0, visibleSections.length - 1));
  const activeSection = visibleSections[activeIndex];
  const firstError = visibleSections.findIndex(section => section.questions.some(question => questionErrors[question.id]));
  useEffect(() => {
    if (firstError >= 0) setSectionIndex(firstError);
  }, [firstError]);
  const move = (next: number) => {
    setSectionIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nextSection = () => {
    if (isPreview || !activeSection || onValidate(activeSection.questions)) move(activeIndex + 1);
  };

  return (
    <div className="animate-in fade-in duration-300">

      <form noValidate onSubmit={event => { if (activeIndex < visibleSections.length - 1) { event.preventDefault(); nextSection(); } else { onSubmit(event); } }} className="flex flex-col gap-5">
        {isEditingExistingResponse && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {lang === "ko"
              ? "이전에 제출한 응답을 수정하는 중입니다. 설문이 열려 있는 동안 다시 저장할 수 있습니다."
              : "You are editing your previous response. Changes can be saved before the survey closes."}
          </div>
        )}


        {(activeSection ? [activeSection] : []).map((section) => (
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

              if (section.id === survey.sections[0]?.id || (!sectionTitle && !sectionDescription)) return null;

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
              if (isSurveyDisplayBlock(question.questionType)) {
                const title = getLocalizedText(lang, question.titleKo, question.titleEn);
                const description = getLocalizedText(
                  lang,
                  question.descriptionKo,
                  question.descriptionEn,
                );

                return (
                  <div
                    key={question.id}
                    className="scroll-mt-24 border-b border-slate-200 px-1 py-3 last:border-b-0"
                  >
                    {title ? (
                      <h2 className="break-words text-xl font-medium leading-7 text-slate-950">
                        <RichTextContent content={title} />
                      </h2>
                    ) : null}
                    {description ? (
                      <RichTextContent
                        content={description}
                        className="mt-2 break-words text-base leading-6 text-slate-600"
                      />
                    ) : null}
                  </div>
                );
              }

              return <SurveyQuestionCard key={question.id} question={question} value={answers[question.id] ?? emptyAnswerValue(question.questionType)} onChange={value => onAnswerChange(question.id, value)} lang={lang} error={questionErrors[question.id]} />;
            })}
          </section>
        ))}

        {submitError ? <p role="alert" className="text-sm text-rose-700">{submitError}</p> : null}

        <div className="survey-response-actions flex flex-wrap items-center gap-3">
          {activeIndex > 0 && <Button type="button" variant="outline" onClick={() => move(activeIndex - 1)}>{lang === "ko" ? "이전" : "Back"}</Button>}
          {activeIndex < visibleSections.length - 1
            ? <Button type="button" variant="outline" onClick={nextSection}>{lang === "ko" ? "다음" : "Next"}</Button>
            : <Button type="submit" disabled={submitting || isPreview}>{submitting ? (lang === "ko" ? "제출 중..." : "Submitting...") : isEditingExistingResponse ? (lang === "ko" ? "저장" : "Save") : (lang === "ko" ? "제출" : "Submit")}</Button>}
          <Button className="ml-auto text-brand-primary" type="button" variant="ghost" onClick={() => { onClear(); move(0); }}>{lang === "ko" ? "양식 지우기" : "Clear form"}</Button>
        </div>
      </form>
    </div>
  );
}
