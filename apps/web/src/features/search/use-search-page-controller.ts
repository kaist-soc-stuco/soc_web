import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleListItem,
  BoardSummary,
  PublicCalendarEventItem,
  SurveyRecord,
  VoteRecord,
} from "@soc/contracts";

import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

import { ABOUT_ITEMS, includesQuery, type SearchFilter } from "./search-utils";

export type SearchBy = "title" | "title_content";

export function useSearchPageController() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [inputValue, setInputValue] = useState(query);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [searchBy, setSearchBy] = useState<SearchBy>("title_content");
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<PublicCalendarEventItem[]>([]);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [faqArticles, setFaqArticles] = useState<ArticleListItem[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    setInputValue(query);
    setFilter("all");
  }, [query]);

  useEffect(() => {
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
      apiClient.getPublicSurveys(),
      apiClient
        .getArticles("FAQ", {
          page: 1,
          limit: 60,
          q: query,
          searchBy,
        })
        .then((response) => response.items)
        .catch(() => [] as ArticleListItem[]),
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
        .catch(() => [] as VoteRecord[]),
      apiClient.getBoards().catch(() => ({ items: [] as BoardSummary[] })),
      apiClient.searchPublicCalendarEvents(query, 40),
    ])
      .then(([articleItems, eventResponse, surveyItems, faqItems, voteItems, boardResponse, calendarResponse]) => {
        if (cancelled) return;
        setArticles([
          ...articleItems,
          ...eventResponse.items.map((item) => ({ ...item, boardCode: "_EVENT" })),
        ]);
        setCalendarEvents(
          calendarResponse.items.filter(
            (item) => item.sourceType === "MANUAL" || item.sourceType === "KAIST_ACADEMIC",
          ),
        );
        setSurveys(
          surveyItems.filter((survey) =>
            includesQuery(
              [
                survey.titleKo,
                survey.titleEn,
                survey.descriptionKo,
                survey.descriptionEn,
                survey.kind,
              ],
              query,
            ),
          ),
        );
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
          setError(
            lang === "ko"
              ? "검색 결과를 불러오지 못했습니다."
              : "Failed to load search results.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, lang, query, searchBy]);

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = inputValue.trim();
    navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
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
    setInputValue,
    setFilter,
    searchBy,
    setSearchBy,
    surveys,
    votes,
    totalCount,
  };
}
