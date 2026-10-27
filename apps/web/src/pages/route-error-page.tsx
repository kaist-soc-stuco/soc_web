import { useRouteError } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { ErrorState } from "@/components/ui/data-state";
import { PageMain } from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";

export function RouteErrorPage({ withHeader = false }: { withHeader?: boolean }) {
  const error = useRouteError();
  const { lang } = useLanguage();

  const content = (
    <PageMain className="flex items-center justify-center px-5 py-16 sm:px-6">
      <ErrorState
        className="w-full max-w-xl"
        headingAs="h1"
        title={lang === "ko" ? "화면을 불러오지 못했습니다" : "Could not load this page"}
        description={lang === "ko"
          ? "일시적인 오류일 수 있습니다.\n잠시 후 다시 시도해 주세요."
          : "This may be a temporary issue.\nPlease try again shortly."}
        onRetry={() => window.location.reload()}
        retryLabel={lang === "ko" ? "다시 시도" : "Try again"}
        error={error}
        requestIdLabel={lang === "ko" ? "요청 번호" : "Request ID"}
      />
    </PageMain>
  );
  return withHeader ? <div className="flex min-h-screen flex-col bg-[var(--ui-surface-canvas)]"><Header />{content}</div> : content;
}
