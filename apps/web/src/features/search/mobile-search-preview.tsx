import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { LoaderCircle } from "lucide-react";
import { useCurrentSession } from "@/hooks/use-current-session";
import { stripRichText } from "@/components/ui/rich-text-content";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { canPreviewSearch } from "./search-preview-query";

export const MOBILE_SEARCH_FILTERS = [
  { value: "all", ko: "전체", en: "All" },
  { value: "board", ko: "게시판", en: "Boards" },
  { value: "faq", ko: "FAQ", en: "FAQ" },
  { value: "event", ko: "행사", en: "Events" },
  { value: "survey", ko: "설문", en: "Surveys" },
] as const;
export type MobileSearchFilter = (typeof MOBILE_SEARCH_FILTERS)[number]["value"];
type PreviewItem = { key: string; href: string; title: string; kind: Exclude<MobileSearchFilter, "all"> };

export function MobileSearchPreview({ query, filter = "all", composing = false, lang, onSelect }: { query: string; filter?: MobileSearchFilter; composing?: boolean; lang: string; onSelect: () => void }) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isPending: sessionPending } = useCurrentSession();
  const value = query.trim();
  const eligible = canPreviewSearch(value, composing);
  const { data: boardDirectory, isPending: boardsLoading } = useQuery({
    queryKey: ["search", "board-directory"], queryFn: () => client.getBoards(),
    enabled: eligible, staleTime: 5 * 60_000, retry: false,
  });
  useEffect(() => {
    if (!eligible) { setDebouncedQuery(""); return; }
    const timeout = window.setTimeout(() => setDebouncedQuery(value), 300);
    return () => window.clearTimeout(timeout);
  }, [eligible, value]);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["mobile-search-preview", session?.userId ?? "anonymous", session?.permission ?? 0, debouncedQuery],
    enabled: eligible && value === debouncedQuery && !sessionPending && !boardsLoading,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const sources = await Promise.allSettled([
        client.searchArticles(debouncedQuery, 15, "title_content"),
        client.getArticles("_EVENT", { page: 1, limit: 3, q: debouncedQuery, searchBy: "title_content" }),
        client.getPublicSurveys({ page: 1, pageSize: 3, query: debouncedQuery }),
        client.getArticles("faq", { page: 1, limit: 5, q: debouncedQuery, searchBy: "title_content" }),
      ]);
      if (sources.every(source => source.status === "rejected")) throw new Error("Search preview unavailable");
      return sources;
    },
    select: (sources) => {
      const items: PreviewItem[] = [];
      const [articles, events, surveys, faqs] = sources;
      if (articles.status === "fulfilled") for (const item of articles.value) {
        const boardCode = item.boardCode ?? boardDirectory?.items.find(board => board.boardId === item.boardId)?.code;
        if (!boardCode) continue;
        items.push({
        key: `article-${item.articleId}`, href: boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${encodeURIComponent(boardCode)}/${item.articleId}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo),
        kind: boardCode === "faq" ? "faq" : boardCode === "_EVENT" ? "event" : "board",
      });
      }
      if (events.status === "fulfilled") for (const item of events.value.items) items.push({
        key: `article-${item.articleId}`, href: `/events/${item.articleId}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo), kind: "event",
      });
      if (surveys.status === "fulfilled") for (const item of surveys.value.items) items.push({
        key: `survey-${item.id}`, href: `/survey/${item.id}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo), kind: "survey",
      });
      if (faqs.status === "fulfilled") for (const item of faqs.value.items) items.push({
        key: `article-${item.articleId}`, href: `/board/faq/${encodeURIComponent(item.articleId)}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo), kind: "faq",
      });
      return {
        items: [...new Map(items.map(item => [item.key, item])).values()],
        failed: (["board", "event", "survey", "faq"] as const).filter((_, index) => sources[index].status === "rejected"),
      };
    },
  });
  if (!eligible || value !== debouncedQuery) return null;
  const waiting = value !== debouncedQuery || isFetching || boardsLoading || sessionPending;
  const visibleItems = data?.items.filter(item => filter === "all" || item.kind === filter).slice(0, 5) ?? [];
  const failed = isError || (filter !== "all" && data?.failed.includes(filter));
  return <section className="mobile-search-preview" aria-label={lang === "ko" ? "추천 검색 항목" : "Search suggestions"} aria-busy={waiting}>
    {waiting && <div className="mobile-search-preview-loading"><LoaderCircle className="size-4 animate-spin" aria-label={lang === "ko" ? "검색 중" : "Searching"} /></div>}
    {visibleItems.map(item => { const label = MOBILE_SEARCH_FILTERS.find(option => option.value === item.kind)!; return <Link key={item.key} to={item.href} onClick={onSelect} className="mobile-search-preview-row"><span>{lang === "ko" ? label.ko : label.en}</span><strong>{item.title}</strong></Link>; })}
    {!waiting && visibleItems.length === 0 && <p role="status">{lang === "ko" ? failed ? "검색하지 못했습니다. 잠시 후 다시 시도해 주세요." : "검색 결과가 없습니다." : failed ? "Search is unavailable. Please try again." : "No results found."}</p>}
  </section>;
}
