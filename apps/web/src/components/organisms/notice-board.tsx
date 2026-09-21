import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { isoToMs, nowMs } from "@soc/shared";
import { ArrowUpRight } from "lucide-react";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatNumericDateRange } from "@/lib/date-display";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

const HOME_NOTICE_LIMIT = 6;

export function NoticeBoard() {
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const noticesQuery = useQuery({
    queryKey: ["articles", "home-notices"],
    queryFn: () => apiClient.getArticles("notice", { limit: 20 }),
    staleTime: 60 * 1000,
  });
  const notices = useMemo(() => {
    const items = (noticesQuery.data?.items ?? [])
      .filter((item) => item.titleKo.trim())
      .sort((a, b) => isoToMs(b.postedAt) - isoToMs(a.postedAt));
    return [
      ...items.filter((item) => item.isPinned).slice(0, 3),
      ...items.filter((item) => !item.isPinned),
    ].slice(0, HOME_NOTICE_LIMIT);
  }, [noticesQuery.data]);

  return (
    <section className="home-notices min-w-0" aria-labelledby="home-notices-title">
      <header className="home-section-heading">
        <h2 id="home-notices-title">
          <Link to="/board/notice" className="home-heading-link">
            {lang === "ko" ? "공지사항" : "Notices"}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </h2>
      </header>
      {noticesQuery.isPending ? (
        <p className="home-editorial-placeholder" role="status">
          {lang === "ko" ? "공지사항을 불러오는 중입니다." : "Loading notices…"}
        </p>
      ) : noticesQuery.isError ? (
        <div className="home-data-error" role="alert">
          <p>{lang === "ko" ? "게시글을 불러오지 못했습니다." : "We couldn't load posts."}</p>
          <Button type="button" variant="outline" size="lg" onClick={() => void noticesQuery.refetch()}>
            {lang === "ko" ? "다시 시도" : "Try again"}
          </Button>
        </div>
      ) : notices.length > 0 ? (
        <ul className="home-editorial-list">
          {notices.map((notice) => {
            const title = lang === "ko" ? notice.titleKo : notice.titleEn || notice.titleKo;
            const isNew = isoToMs(notice.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
            return (
              <li key={notice.articleId}>
                <Link to={`/board/notice/${notice.articleId}`} className="home-notice-entry">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <h3 className="truncate">{title}</h3>
                      {isNew ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-rose-500">
                          <span className="sr-only">{lang === "ko" ? "새 글" : "New post"}</span>
                        </span>
                      ) : null}
                    </div>
                    <time className="home-notice-entry-time shrink-0" dateTime={notice.postedAt}>
                      {formatNumericDateRange(notice.postedAt, notice.postedAt)}
                    </time>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="home-editorial-placeholder">
          {lang === "ko" ? "등록된 공지사항이 없습니다." : "No notices available."}
        </p>
      )}
    </section>
  );
}
