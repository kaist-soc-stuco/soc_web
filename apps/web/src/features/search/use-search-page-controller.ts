import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleListItem,
  BoardSummary,
  PublicCalendarEventItem,
  PublicSurveyRecord,
  VoteRecord,
} from "@soc/contracts";

import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

import { ABOUT_ITEMS, includesQuery, type SearchFilter } from "./search-utils";

export type PartialSearchKind = "faq" | "vote";
export type SearchBy = "title" | "title_content";


export function useSearchPageController() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [inputValue, setInputValue] = useState(query);
  const filter: SearchFilter = (["all", "board", "faq", "event", "survey", "vote"] as const).find(value => value === searchParams.get("type")) ?? "all";
  const searchBy: SearchBy = searchParams.get("by") === "title" ? "title" : "title_content";
  const updateSearchOption = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true, state: { preserveScroll: true } });
  };
  const setFilter = (value: SearchFilter) => updateSearchOption("type", value === "all" ? "" : value);
  const setSearchBy = (value: SearchBy) => updateSearchOption("by", value === "title_content" ? "" : value);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<PublicCalendarEventItem[]>([]);
  const [surveys, setSurveys] = useState<PublicSurveyRecord[]>([]);
  const [faqArticles, setFaqArticles] = useState<ArticleListItem[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const [more, setMore] = useState({ event: false, survey: false });
  const [pages, setPages] = useState({ event: 1, survey: 1 });
  const [loadingMore, setLoadingMore] = useState<"event" | "survey" | null>(null);
  const moreBusy = useRef(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<PartialSearchKind[]>([]);
  const [retryingPart, setRetryingPart] = useState<PartialSearchKind | null>(null);
  const retryPartLock = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    generation.current++;
    setPartialErrors([]); setRetryingPart(null); retryPartLock.current = false;
    setMore({ event: false, survey: false });
    setPages({ event: 1, survey: 1 });
    setLoadingMore(null); moreBusy.current = false; setMoreError(null);
    if (!query) {
      setArticles([]);
      setCalendarEvents([]);
      setSurveys([]);
      setFaqArticles([]);
      setVotes([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.searchArticles(query, 60, searchBy),
      apiClient.getArticles("_EVENT", {
        page: 1,
        limit: 60,
        q: query,
        searchBy,
      }),
      apiClient.getPublicSurveys({ page: 1, pageSize: 100, query }),
      apiClient
        .getArticles("faq", {
          page: 1,
          limit: 60,
          q: query,
          searchBy,
        })
        .then((response) => response.items)
        .catch(() => { if (!cancelled) setPartialErrors(previous => [...previous, "faq"]); return [] as ArticleListItem[]; }),
      apiClient
        .listPublicVotes()
        .then((items) =>
          items.filter((vote) =>
            includesQuery(
              searchBy === "title"
                ? [vote.titleKo, vote.titleEn]
                : [
                    vote.titleKo,
                    vote.titleEn,
                    vote.descriptionKo,
                    vote.descriptionEn,
                  ],
              query,
            ),
          ),
        )
        .catch(() => { if (!cancelled) setPartialErrors(previous => [...previous, "vote"]); return [] as VoteRecord[]; }),
      apiClient.getBoards().catch(() => ({ items: [] as BoardSummary[] })),
      apiClient.searchPublicCalendarEvents(query, 40),
    ])
      .then(([articleItems, eventResponse, surveyResponse, faqItems, voteItems, boardResponse, calendarResponse]) => {
        if (cancelled) return;
        setMore({ event: eventResponse.total > eventResponse.items.length, survey: surveyResponse.total > surveyResponse.items.length });
        setArticles([
          ...articleItems,
          ...eventResponse.items.map((item) => ({ ...item, boardCode: "_EVENT" })),
        ]);
        setCalendarEvents(
          calendarResponse.items.filter(
            (item) => item.sourceType === "MANUAL" || item.sourceType === "KAIST_ACADEMIC",
          ),
        );
        setSurveys(surveyResponse.items);
        setFaqArticles(faqItems);
        setVotes(voteItems);
        setBoards(boardResponse.items);
      })
      .catch(() => {
        if (!cancelled) {
          setArticles([]);
          setCalendarEvents([]);
          setSurveys([]);
          setFaqArticles([]);
          setVotes([]);
          setError(lang === "ko" ? "검색 결과를 불러오지 못했습니다." : "Failed to load search results.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      generation.current++;
    };
  }, [apiClient, lang, query, retryKey, searchBy]);

  const boardById = useMemo(
    () => new Map(boards.map((board) => [board.boardId, board])),
    [boards],
  );

  const eventArticles = useMemo(
    () => articles.filter((article) => article.boardCode === "_EVENT"),
    [articles],
  );

  const boardArticles = useMemo(
    () => articles.filter((article) => article.boardCode !== "_EVENT"),
    [articles],
  );

  const aboutResults = useMemo(() => {
    if (!query) return [];
    return ABOUT_ITEMS.filter((item) =>
      includesQuery(
        [
          item.titleKo,
          item.titleEn,
          item.descriptionKo,
          item.descriptionEn,
          ...item.keywords,
        ],
        query,
      ),
    );
  }, [query]);

  const totalCount =
    boardArticles.length +
    faqArticles.length +
    eventArticles.length +
    surveys.length +
    votes.length +
    calendarEvents.length +
    aboutResults.length;

  const loadMore = async (kind: "event" | "survey") => {
    if (moreBusy.current) return;
    moreBusy.current = true;
    const requestGeneration = generation.current;
    const page = pages[kind] + 1;
    setLoadingMore(kind); setMoreError(null);
    try {
      if (kind === "event") {
        const result = await apiClient.getArticles("_EVENT", { page, limit: 60, q: query, searchBy });
        if (requestGeneration !== generation.current) return;
        setArticles(previous => {
          const ids = new Set(previous.map(item => item.articleId));
          return [...previous, ...result.items.filter(item => !ids.has(item.articleId)).map(item => ({ ...item, boardCode: "_EVENT" }))];
        });
        setMore(previous => ({ ...previous, event: page * 60 < result.total && result.items.length > 0 }));
      } else {
        const result = await apiClient.getPublicSurveys({ page, pageSize: 100, query });
        if (requestGeneration !== generation.current) return;
        setSurveys(previous => [...previous, ...result.items.filter(item => !previous.some(existing => existing.id === item.id))]);
        setMore(previous => ({ ...previous, survey: page * 100 < result.total && result.items.length > 0 }));
      }
      setPages(previous => ({ ...previous, [kind]: page }));
    } catch {
      if (requestGeneration === generation.current) setMoreError(lang === "ko" ? "추가 결과를 불러오지 못했습니다. 더보기를 눌러 다시 시도해 주세요." : "Could not load more results. Select Show more to retry.");
    } finally {
      if (requestGeneration === generation.current) { setLoadingMore(null); moreBusy.current = false; }
    }
  };

  const retryPart = async (kind: PartialSearchKind) => {
    if (retryPartLock.current) return;
    retryPartLock.current = true; setRetryingPart(kind);
    const requestGeneration = generation.current;
    try {
      if (kind === "faq") {
        const result = await apiClient.getArticles("faq", { page: 1, limit: 60, q: query, searchBy });
        if (requestGeneration !== generation.current) return;
        setFaqArticles(result.items);
      } else {
        const result = await apiClient.listPublicVotes();
        if (requestGeneration !== generation.current) return;
        setVotes(result.filter(vote => includesQuery(searchBy === "title" ? [vote.titleKo, vote.titleEn] : [vote.titleKo, vote.titleEn, vote.descriptionKo, vote.descriptionEn], query)));
      }
      setPartialErrors(previous => previous.filter(value => value !== kind));
    } catch {
      // Keep the section's error and retry action; successful sections stay visible.
    } finally {
      if (requestGeneration === generation.current) { retryPartLock.current = false; setRetryingPart(null); }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = inputValue.trim();
    const next = new URLSearchParams(searchParams);
    if (nextQuery) next.set("q", nextQuery); else next.delete("q");
    navigate(`/search${next.size ? `?${next.toString()}` : ""}`);
  };

  return {
    aboutResults,
    boardById,
    boardArticles,
    calendarEvents,
    eventArticles,
    faqArticles,
    error,
    filter,
    handleSubmit,
    inputValue,
    lang,
    loading,
    query,
    retrySearch: () => setRetryKey((current) => current + 1),
    setInputValue,
    setFilter,
    searchBy,
    setSearchBy,
    surveys,
    votes,
    totalCount,
    more, loadingMore, moreError, loadMore,
    partialErrors, retryingPart, retryPart,
  };
}
