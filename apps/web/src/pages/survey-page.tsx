import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { SurveyResponseForm } from "@/features/survey/survey-response-form";
import { SurveyParticipationNotice } from "@/features/survey/survey-participation-notice";
import {
  AlreadySubmittedView,
  BeforeOpenView,
  ClosedView,
  LoginRequiredView,
  SuccessView,
} from "@/features/survey/survey-state-views";
import { SurveySummaryCard } from "@/features/survey/survey-summary-card";
import { useSurveyPageController } from "@/features/survey/use-survey-page-controller";
import { PageShell } from "@/components/ui/page-layout";
import { useToast } from "@/components/ui/toast";

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const {
    answers,
    draftRestored,
    handleAnswerChange,
    handleNextSection,
    handleSubmit,
    lang,
    loadError,
    questionErrors,
    resetResponseDraft,
    session,
    sessionLoading,
    submitError,
    submitted,
    responseSubmittedAt,
    submitting,
    survey,
    visibleSectionIds,
  } = useSurveyPageController(id);
  const { toast } = useToast();
  const draftToastShownRef = useRef(false);

  const isPreview = Boolean(survey?.isPreview || (survey && !survey.isPublished));
  // A temporary consent session is authenticated for eligibility checks, but
  // it still cannot access persistent account features.
  const sessionAuthenticated = Boolean(session?.authenticated);

  useEffect(() => {
    if (!draftRestored) {
      draftToastShownRef.current = false;
      return;
    }
    if (draftToastShownRef.current || isPreview) return;

    draftToastShownRef.current = true;
    toast({
      type: "info",
      duration: 8000,
      message:
        lang === "ko"
          ? "이전에 입력한 응답을 불러왔습니다."
          : "Your saved response has been restored.",
      action: {
        label: lang === "ko" ? "새로 쓰기" : "Start over",
        onClick: resetResponseDraft,
      },
    });
  }, [draftRestored, isPreview, lang, resetResponseDraft, toast]);
  const renderBody = () => {
    if (loadError) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-red-500 font-bold shadow-xl">
          {loadError}
        </div>
      );
    }
    if (!survey || sessionLoading) return null;
    if (submitted) {
      return (
        <SuccessView
          lang={lang}
          resultVisibility={survey.resultVisibility}
          surveyId={id!}
          submittedAt={responseSubmittedAt}
        />
      );
    }

    if (!isPreview && survey.computedState === "before_open") {
      return <BeforeOpenView opensAt={survey.opensAt} lang={lang} />;
    }
    if (!isPreview && survey.computedState === "closed") {
      return <ClosedView lang={lang} />;
    }

    if (
      !isPreview &&
      (survey.participationEligibility?.status === "LOGIN_REQUIRED" ||
        (!sessionAuthenticated && !survey.allowAnonymous))
    ) {
      return <LoginRequiredView lang={lang} />;
    }

    if (
      !isPreview &&
      survey.participationEligibility?.status === "NOT_ELIGIBLE"
    ) {
      return (
        <SurveyParticipationNotice
          eligibility={survey.participationEligibility}
          lang={lang}
        />
      );
    }

    if (
      !isPreview &&
      survey.hasSubmitted &&
      !survey.allowMultipleResponses &&
      !survey.allowResponseEdit
    ) {
      return (
        <AlreadySubmittedView
          lang={lang}
          resultVisibility={survey.resultVisibility}
          surveyId={id!}
          submittedAt={responseSubmittedAt}
        />
      );
    }

    const isEditingExistingResponse =
      Boolean(survey.currentResponse) &&
      survey.allowResponseEdit &&
      !survey.allowMultipleResponses;

    return (
      <SurveyResponseForm
        answers={answers}
        isEditingExistingResponse={isEditingExistingResponse}
        isPreview={isPreview}
        lang={lang}
        onAnswerChange={handleAnswerChange}
        onNextSection={handleNextSection}
        onSubmit={handleSubmit}
        questionErrors={questionErrors}
        submitError={submitError}
        submitting={submitting}
        survey={survey}
        visibleSectionIds={visibleSectionIds}
      />
    );
  };

  return (
    <PageShell>
      <Header />
      <main className="channel-talk-safe-area flex-1 bg-[#f3f5f4] px-4 py-10 lg:px-0" aria-busy={(!survey || sessionLoading) && !loadError}>
        <div className="mx-auto max-w-[52rem] space-y-5">
          {survey && <SurveySummaryCard lang={lang} survey={survey} />}
          {renderBody()}
        </div>
      </main>
    </PageShell>
  );
}
