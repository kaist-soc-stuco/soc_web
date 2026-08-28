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

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const {
    answers,
    handleAnswerChange,
    handleSubmit,
    lang,
    loadError,
    questionErrors,
    session,
    sessionLoading,
    submitError,
    submitted,
    responseSubmittedAt,
    submitting,
    survey,
    visibleSectionIds,
  } = useSurveyPageController(id);

  const isPreview = Boolean(survey?.isPreview || (survey && !survey.isPublished));
  const sessionAuthenticated = Boolean(
    session?.authenticated && session.canUsePersistentFeatures,
  );
  const shouldEmbedTerminalState = Boolean(
    survey &&
      !sessionLoading &&
      (submitted ||
        (!isPreview &&
          (survey.computedState === "closed" ||
            (sessionAuthenticated &&
              survey.hasSubmitted &&
              !survey.allowMultipleResponses &&
              !survey.allowResponseEdit)))),
  );

  const renderBody = (embedded = false) => {
    if (loadError) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-red-500 font-bold shadow-xl">
          {loadError}
        </div>
      );
    }
    if (!survey || sessionLoading) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-kaist-grey/60 font-medium shadow-xl">
          {lang === "ko" ? "불러오는 중..." : "Loading..."}
        </div>
      );
    }
    if (submitted) {
      return (
        <SuccessView
          embedded={embedded}
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
          embedded={embedded}
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
      <main className="flex-1 bg-[#f3f5f4] px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-[52rem]">
          {survey && shouldEmbedTerminalState ? (
            <SurveySummaryCard lang={lang} survey={survey}>
              {submitted ? (
                renderBody(true)
              ) : survey.computedState === "closed" ? (
                <ClosedView embedded lang={lang} />
              ) : (
                renderBody(true)
              )}
            </SurveySummaryCard>
          ) : (
            <>
              {survey && <SurveySummaryCard lang={lang} survey={survey} />}
              {renderBody()}
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
}
