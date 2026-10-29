import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { LoaderCircle } from "lucide-react";
import { useCurrentSession } from "@/hooks/use-current-session";
import { stripRichText } from "@/components/ui/rich-text-content";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { canPreviewSearch } from "./search-preview-query";

type PreviewItem = { key: string; href: string; title: string; kind: string };

export function MobileSearchPreview({ query, composing = false, lang, onSelect }: { query: string; composing?: boolean; lang: string; onSelect: () => void }) {
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
        client.searchArticles(debouncedQuery, 5, "title_content"),
        client.getArticles("_EVENT", { page: 1, limit: 3, q: debouncedQuery, searchBy: "title_content" }),
        client.getPublicSurveys({ page: 1, pageSize: 3, query: debouncedQuery }),
      ]);
      if (sources.every(source => source.status === "rejected")) throw new Error("Search preview unavailable");
      return sources;
    },
    select: (sources) => {
      const items: PreviewItem[] = [];
      const [articles, events, surveys] = sources;
      if (articles.status === "fulfilled") for (const item of articles.value) {
        const boardCode = item.boardCode ?? boardDirectory?.items.find(board => board.boardId === item.boardId)?.code;
        if (!boardCode) continue;
        items.push({
        key: `article-${item.articleId}`, href: boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${encodeURIComponent(boardCode)}/${item.articleId}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo),
        kind: boardCode === "faq" ? "FAQ" : boardCode === "_EVENT" ? lang === "ko" ? "행사" : "Event" : lang === "ko" ? "게시판" : "Board",
      });
      }
      if (events.status === "fulfilled") for (const item of events.value.items) items.push({
        key: `article-${item.articleId}`, href: `/events/${item.articleId}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo), kind: lang === "ko" ? "행사" : "Event",
      });
      if (surveys.status === "fulfilled") for (const item of surveys.value.items) items.push({
        key: `survey-${item.id}`, href: `/survey/${item.id}`,
        title: stripRichText(lang === "en" && item.titleEn ? item.titleEn : item.titleKo), kind: lang === "ko" ? "설문" : "Survey",
      });
      return [...new Map(items.map(item => [item.key, item])).values()].slice(0, 5);
    },
  });
  if (!eligible || value !== debouncedQuery) return null;
  const waiting = value !== debouncedQuery || isFetching || boardsLoading || sessionPending;
  return <section className="mobile-search-preview" aria-label={lang === "ko" ? "추천 검색 항목" : "Search suggestions"} aria-busy={waiting}>
    {waiting && <div className="mobile-search-preview-loading"><LoaderCircle className="size-4 animate-spin" aria-label={lang === "ko" ? "검색 중" : "Searching"} /></div>}
    {value === debouncedQuery && data?.map(item => <Link key={item.key} to={item.href} onClick={onSelect} className="mobile-search-preview-row"><span>{item.kind}</span><strong>{item.title}</strong></Link>)}
    {!waiting && (!data || data.length === 0) && <p role="status">{lang === "ko" ? isError ? "검색하지 못했습니다. 잠시 후 다시 시도해 주세요." : "검색 결과가 없습니다." : isError ? "Search is unavailable. Please try again." : "No results found."}</p>}
  </section>;
}
