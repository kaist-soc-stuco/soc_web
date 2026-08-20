import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/organisms/footer";
import { Header } from "@/components/organisms/header";
import { useLanguage } from "@/hooks/use-language";

export function NotFoundPage() {
  const { lang } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header showLogo />
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-16 md:px-8">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen" />
          <div className="grid gap-10 p-8 md:grid-cols-[12rem_1fr] md:p-12">
            <div className="flex h-40 items-center justify-center rounded-2xl bg-kaist-lightgreen/10 text-6xl font-black tracking-tight text-kaist-darkgreen">
              404
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kaist-darkgreen">
                {lang === "ko" ? "페이지를 찾을 수 없음" : "Page not found"}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                {lang === "ko"
                  ? "요청한 주소에 페이지가 없습니다."
                  : "We couldn't find that page."}
              </h1>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-500">
                {lang === "ko"
                  ? "주소가 바뀌었거나 페이지가 이동되었을 수 있습니다. 홈이나 이전 페이지에서 다시 찾아보세요."
                  : "The address may have changed or the page may have moved. Return home or go back and try again."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-kaist-darkgreen px-5 text-sm font-black text-white transition-colors hover:bg-kaist-darkgreen/90"
                >
                  <Home aria-hidden="true" className="h-4 w-4" />
                  {lang === "ko" ? "홈으로" : "Go home"}
                </Link>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  {lang === "ko" ? "이전 페이지" : "Go back"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
