import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { PageShell } from "@/components/ui/page-layout";
import { MobileDetailHeader } from "@/components/ui/mobile-detail-header";
import { useLocation } from "react-router-dom";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLanguage } from "@/hooks/use-language";
import { getBoardLabelFromMetadata } from "@/lib/board-metadata";

/** Keep short loads quiet; only indicate progress when the wait is noticeable. */
export function ArticleLoading({ mobileHeader }: { mobileHeader?: ReactNode } = {}) {
  const [showProgress, setShowProgress] = useState(false);
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const category = pathname.startsWith("/events/") ? "_EVENT" : pathname.split("/")[2] ?? "notice";
  useEffect(() => {
    const timer = window.setTimeout(() => setShowProgress(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  return <PageShell className="mobile-flat-detail">
    {mobileHeader ?? (isMobile && <MobileDetailHeader title={category === "_EVENT" ? (lang === "ko" ? "행사" : "Events") : getBoardLabelFromMetadata(undefined, category, lang)} backTo={category === "_EVENT" ? "/events" : `/board/${category}`} lang={lang} />)}
    <main aria-busy="true" aria-label="게시글 불러오기" className="mx-auto w-full flex-1 pb-28">
      <div className="mx-auto flex w-full max-w-[var(--ui-article-max-width)] flex-col gap-3 px-4 pb-16 pt-6 min-[360px]:px-5 min-[640px]:px-6 lg:px-8">
        <div aria-hidden="true" className="h-11" />
        <div className="flex min-h-[30rem] justify-center pt-16">
          {showProgress ? <Loader2 aria-hidden="true" className="size-5 animate-spin text-slate-400 motion-reduce:animate-none" /> : null}
        </div>
      </div>
    </main>
  </PageShell>;
}
