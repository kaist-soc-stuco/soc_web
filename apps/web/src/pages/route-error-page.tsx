import { useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/data-state";
import { useLanguage } from "@/hooks/use-language";

export function RouteErrorPage() {
  const error = useRouteError();
  const { lang } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ui-surface-canvas)] px-6 py-12">
      <ErrorState
        className="w-full max-w-xl"
        title={lang === "ko" ? "화면을 불러오지 못했습니다" : "Could not load this page"}
        description={lang === "ko"
          ? "새로고침한 뒤 다시 시도해 주세요. 문제가 계속되면 잠시 후 다시 방문해 주세요."
          : "Refresh the page and try again. If the problem continues, please come back later."}
        onRetry={() => window.location.reload()}
        retryLabel={lang === "ko" ? "새로고침" : "Refresh"}
        error={error}
        requestIdLabel={lang === "ko" ? "요청 번호" : "Request ID"}
        actions={<Button asChild size="sm" variant="outline"><a href="/">{lang === "ko" ? "홈으로 이동" : "Go home"}</a></Button>}
      />
    </main>
  );
}
