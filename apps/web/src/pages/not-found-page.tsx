import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { lang } = useLanguage();

  return (
      <main className="flex w-full flex-1 items-center justify-center bg-[var(--ui-surface-canvas)] px-6 py-20 sm:px-8">
        <section className="w-full max-w-lg text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Compass aria-hidden="true" className="size-6" strokeWidth={1.7} />
          </div>
          <h1 className="text-xl font-semibold leading-7 tracking-tight text-slate-900 sm:text-2xl sm:leading-8">
            {lang === "ko" ? "페이지를 찾을 수 없습니다" : "Page not found"}
          </h1>
          <p className="mx-auto mt-3 max-w-sm break-keep text-sm font-normal leading-6 text-slate-500">
            {lang === "ko"
              ? "페이지가 이동되었거나 삭제되었습니다. 입력하신 주소를 다시 확인해 주세요."
              : "This page has moved or been removed. Please check the address and try again."}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="default">
              <Link to="/">
                {lang === "ko" ? "홈으로 이동" : "Go home"}
              </Link>
            </Button>
          </div>
        </section>
      </main>
  );
}
