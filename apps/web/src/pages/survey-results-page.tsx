import { ChevronLeft } from "lucide-react";

import { SurveyResultsContent } from "@/features/survey-results/survey-results-sections";
import { useSurveyResultsPageController } from "@/features/survey-results/use-survey-results-page-controller";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-layout";
import { MobileDetailHeader } from "@/components/ui/mobile-detail-header";

export function SurveyResultsPage() {
  const { analytics, error, lang, loading, navigateBack, retry } =
    useSurveyResultsPageController();

  return (
    <PageShell className="mobile-state-page">
      {error ? <MobileDetailHeader title="" backTo="/surveys" lang={lang} /> : null}
      <main className="flex-1 bg-[#f3f5f4] px-4 py-6 sm:py-10 lg:px-0" aria-busy={loading}>
        <div className="mx-auto max-w-[52rem]">
          <div className={`mb-4 ${error ? "max-md:hidden" : ""}`}>
            <Button variant="ghost"
              type="button"
              onClick={navigateBack}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent text-xs font-semibold text-slate-400 transition-colors hover:text-kaist-darkgreen"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {lang === "ko" ? "목록으로" : "Back to list"}
            </Button>
          </div>
          <SurveyResultsContent
            analytics={analytics}
            error={error}
            lang={lang}
            loading={loading}
            onRetry={retry}
          />
        </div>
      </main>
    </PageShell>
  );
}
