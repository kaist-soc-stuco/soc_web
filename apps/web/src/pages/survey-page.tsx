import { ResponsePageMain } from "@/features/survey/response-layout";
import { useEffect, useRef } from "react";
import { OPERATIONAL_SURVEY_IDS } from "@soc/contracts";
import { Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ErrorState } from "@/components/ui/data-state";
import { useToast } from "@/components/ui/toast";

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  return id === OPERATIONAL_SURVEY_IDS.corporatePartnership ? <Navigate to="/about#partnership" replace /> : <ActiveSurveyPage />;
}

function ActiveSurveyPage() {
  const { id } = useParams<{ id: string }>();
  const {
    answers,
    draftHydrated,
    draftRestored,
    handleAnswerChange,
    validateRequiredQuestions,
    handleSubmit,
    lang,
    loadError,
    retryLoad,
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

  const isPreview = Boolean(new URLSearchParams(window.location.search).get("preview") === "1" || survey?.isPreview || (survey && !survey.isPublished));
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

  if (loadError) {
    return (
      <PageShell>
        <ResponsePageMain>
          <ErrorState
            className="rounded-xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)]"
            description={
              lang === "ko"
                ? "일시적인 네트워크 오류일 수 있습니다. 잠시 후 다시 시도해 주세요."
                : "This may be a temporary network issue. Please try again in a moment."
            }
            onRetry={retryLoad}
            title={lang === "ko" ? "설문을 불러오지 못했습니다." : "We couldn't load this survey."}
          />
        </ResponsePageMain>
      </PageShell>
    );
  }

  const renderBody = () => {
    if (!survey || sessionLoading || !draftHydrated) return null;
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
      !isPreview && Boolean(survey.currentResponse) &&
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
        onClear={resetResponseDraft}
        onValidate={validateRequiredQuestions}
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
      {isPreview && <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-8">
        <a href={`/admin/surveys/${id}/edit`} className="inline-flex items-center gap-3 text-sm"><ArrowLeft className="size-4" />미리보기 모드</a>
        <div className="flex items-center gap-4">{survey?.isPublished && <span className="inline-flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="size-4" />게시됨</span>}<Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(new URL(`/survey/${id}`, location.origin).href); toast({type:"success",message:"응답자 링크를 복사했습니다."}); } catch { toast({type:"error",message:"링크를 복사하지 못했습니다."}); } }}><LinkIcon className="size-4" />응답자 링크 복사</Button></div>
      </header>}
      <ResponsePageMain busy={(!survey || sessionLoading || !draftHydrated) && !loadError}>
          {survey && <SurveySummaryCard lang={lang} survey={survey} />}
          {renderBody()}
      </ResponsePageMain>
    </PageShell>
  );
}
