import { ChevronLeft } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { SurveyResultsContent } from "@/features/survey-results/survey-results-sections";
import { useSurveyResultsPageController } from "@/features/survey-results/use-survey-results-page-controller";

export function SurveyResultsPage() {
  const { analytics, error, lang, loading, navigateBack } =
    useSurveyResultsPageController();

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <Header showLogo />
      <main className="flex-1 px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-[52rem]">
          <div className="mb-4">
            <button
              type="button"
              onClick={navigateBack}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent text-xs font-extrabold text-slate-400 transition-colors hover:text-kaist-darkgreen"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {lang === "ko" ? "이전 페이지로" : "Go back"}
            </button>
          </div>
          <SurveyResultsContent
            analytics={analytics}
            error={error}
            lang={lang}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}
