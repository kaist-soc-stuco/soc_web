import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-layout";

export function NotFoundPage() {
  const { lang } = useLanguage();

  return (
    <PageShell>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-20 sm:px-8">
        <section className="w-full max-w-3xl text-center">
          <p className="text-8xl font-black tracking-[-0.08em] text-slate-200 sm:text-9xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {lang === "ko" ? "페이지를 찾을 수 없습니다" : "Page not found"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-7 text-slate-500 sm:text-base">
            {lang === "ko"
              ? "존재하지 않거나 삭제되어 찾을 수 없는 페이지입니다. 입력하신 주소가 정확한지 다시 확인해 주세요."
              : "This page does not exist or has been removed. Please check that the address is correct and try again."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="default" size="lg" className="font-semibold">
              <Link to="/">
                <Home aria-hidden="true" className="size-4" />
                {lang === "ko" ? "홈으로 이동" : "Go home"}
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="font-semibold"
              onClick={() => window.history.back()}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {lang === "ko" ? "이전 페이지" : "Go back"}
            </Button>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
