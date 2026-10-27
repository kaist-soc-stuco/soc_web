import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function EventsSurveysLoadMore({ hasMore, loading, failed, onLoadMore, lang }: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => void;
  lang: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading || failed || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore();
    }, { rootMargin: "240px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, failed, onLoadMore]);
  if (!hasMore) return null;
  return <div ref={sentinel} className={`discovery-load-more${loading || failed ? " is-loading" : ""}`} aria-live="polite">
    {failed ? <Button variant="ghost" onClick={onLoadMore}>{lang === "ko" ? "추가 목록 다시 불러오기" : "Retry loading more"}</Button>
      : loading ? <span role="status" className="sr-only">{lang === "ko" ? "추가 목록을 불러오는 중…" : "Loading more…"}</span> : null}
  </div>;
}
