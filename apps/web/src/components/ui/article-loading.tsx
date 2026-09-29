import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PageShell } from "@/components/ui/page-layout";

/** Keep short loads quiet; only indicate progress when the wait is noticeable. */
export function ArticleLoading() {
  const [showProgress, setShowProgress] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowProgress(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  return <PageShell>
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
