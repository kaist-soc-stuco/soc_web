import { useParams } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { SurveyResponseForm } from "@/features/survey/survey-response-form";
import {
  AlreadySubmittedView,
  BeforeOpenView,
  ClosedView,
  KoreanOnlyWarningView,
  LoginRequiredView,
  SuccessView,
} from "@/features/survey/survey-state-views";
import { SurveySummaryCard } from "@/features/survey/survey-summary-card";
import { useSurveyPageController } from "@/features/survey/use-survey-page-controller";

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const {
    allQuestions,
    answers,
    handleAnswerChange,
    handleSubmit,
    lang,
    loadError,
    session,
    sessionLoading,
    submitError,
    submitted,
    submitting,
    survey,
  } = useSurveyPageController(id);

  const renderBody = () => {
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
          lang={lang}
          resultVisibility={survey.resultVisibility}
          surveyId={id!}
        />
      );
    }

    const isPreview = Boolean(survey.isPreview || !survey.isPublished);
    if (!isPreview && survey.computedState === "before_open") {
      return <BeforeOpenView opensAt={survey.opensAt} lang={lang} />;
    }
    if (!isPreview && survey.computedState === "closed") {
      return <ClosedView lang={lang} />;
    }

    const sessionAuthenticated = Boolean(
      session?.authenticated && session.canUsePersistentFeatures,
    );
    if (!isPreview && !sessionAuthenticated) {
      return (
        <LoginRequiredView lang={lang} feePayersOnly={survey.feePayersOnly} />
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
        />
      );
    }

    if (
      !isPreview &&
      survey.isKoreanOnly &&
      session?.nameKo &&
      session?.nameEn &&
      session.nameKo === session.nameEn
    ) {
      return <KoreanOnlyWarningView lang={lang} />;
    }

    const isEditingExistingResponse =
      Boolean(survey.currentResponse) &&
      survey.allowResponseEdit &&
      !survey.allowMultipleResponses;

    return (
      <SurveyResponseForm
        allQuestions={allQuestions}
        answers={answers}
        isEditingExistingResponse={isEditingExistingResponse}
        isPreview={isPreview}
        lang={lang}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitting={submitting}
        survey={survey}
      />
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <Header showLogo />
      <main className="flex-1 px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-[52rem]">
          {survey && <SurveySummaryCard lang={lang} survey={survey} />}
          {renderBody()}
        </div>
      </main>
    </div>
  );
}
