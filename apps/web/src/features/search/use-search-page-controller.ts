import { useEffect, useMemo, useState, type FormEvent } from "react";
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

export type SearchBy = "title" | "title_content";
const PUBLIC_LIST_PAGE_REQUIRED = "public_list_page_required";

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
  const [surveys, setSurveys] = useState<PublicSurveyRecord[]>([]);
  const [faqArticles, setFaqArticles] = useState<ArticleListItem[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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
      apiClient.getPublicSurveys({ page: 1, pageSize: 100, query }),
      apiClient
        .getArticles("faq", {
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
      .then(([articleItems, eventResponse, surveyResponse, faqItems, voteItems, boardResponse, calendarResponse]) => {
        if (cancelled) return;
        if (
          eventResponse.total > eventResponse.items.length ||
          surveyResponse.total > surveyResponse.items.length
        ) {
          throw new Error(PUBLIC_LIST_PAGE_REQUIRED);
        }
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
          surveyResponse.items.filter((survey) =>
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
      .catch((cause) => {
        if (!cancelled) {
          setArticles([]);
          setCalendarEvents([]);
          setSurveys([]);
          setFaqArticles([]);
          setVotes([]);
          setError(
            cause instanceof Error && cause.message === PUBLIC_LIST_PAGE_REQUIRED
              ? lang === "ko"
                ? "검색 결과가 많아 한 번에 표시할 수 없습니다. 검색어를 더 구체적으로 입력해 주세요."
                : "There are too many search results to display at once. Make your search more specific."
              : lang === "ko"
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
    retrySearch: () => setRetryKey((current) => current + 1),
    setInputValue,
    setFilter,
    searchBy,
    setSearchBy,
    surveys,
    votes,
    totalCount,
  };
}
