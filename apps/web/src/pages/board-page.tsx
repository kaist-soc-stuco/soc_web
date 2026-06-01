import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { CurrentUserResponse, ArticleListItem } from "@soc/contracts";
import { hasPermission, isoToDate, isoToMs, nowMs } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { ArrowDown, Filter, Paperclip, Pin, Search } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  getBoardDescriptionFromMetadata,
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import { useLanguage } from "@/hooks/use-language";
import { PageHero } from "@/components/organisms/page-hero";
import { useBoardCatalog } from "@/hooks/use-board-catalog";

type SearchCriteria = "title" | "author" | "title_content";
type SortBy = "latest" | "views";
type SortDirection = "asc" | "desc";
type Period = "all" | "7days" | "30days";

function comparePinnedArticles(a: ArticleListItem, b: ArticleListItem) {
  if (a.isPinned !== b.isPinned) {
    return Number(b.isPinned) - Number(a.isPinned);
  }

  if (a.isPinned && b.isPinned) {
    const aOrder = a.pinOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.pinOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
  }

  return 0;
}

function formatDate(dateIso: string) {
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function BoardPage() {
  const { category } = useParams<{ category?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(
    null,
  );
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();

  // Advanced filter states
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>("title");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [period, setPeriod] = useState<Period>("all");

  // Page size option
  const [postsPerPage, setPostsPerPage] = useState(10);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards, boardByCode } = useBoardCatalog(apiClient);
  const currentBoard = category ? boardByCode.get(category) : undefined;

  useEffect(() => {
    let cancelled = false;

    void apiClient
      .getCurrentUser()
      .then((response) => {
        if (!cancelled) {
          setCurrentUser(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const totalPages = Math.ceil(totalCount / postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (nextSortBy: SortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((currentDirection) =>
        currentDirection === "desc" ? "asc" : "desc",
      );
    } else {
      setSortBy(nextSortBy);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    let cancelled = false;

    const queryParam = searchCriteria === "title" ? searchQuery : "";
    const fetchPromise = category
      ? apiClient.getArticles(category, { page: 1, limit: 100, q: queryParam })
      : apiClient.getAllArticles({
          limit: postsPerPage,
          page: currentPage,
          period,
          q: searchQuery,
          searchBy: searchCriteria,
          sortBy,
          sortDirection,
        });

    fetchPromise.then((data) => {
      if (!cancelled) {
        let items = [...data.items];

        if (!category) {
          items.sort((a, b) => {
            const pinnedOrder = comparePinnedArticles(a, b);
            if (pinnedOrder !== 0) return pinnedOrder;
            return 0;
          });
          setArticles(items);
          setTotalCount(data.total);
          return;
        }

        // 1. Search Query Filters (Client-side)
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (searchCriteria === "author") {
            items = items.filter((item) => {
              const authorName = item.isAnonymous ? "익명" : item.author.name;
              return authorName.toLowerCase().includes(query);
            });
          } else if (searchCriteria === "title_content") {
            items = items.filter((item) => {
              const title = (
                lang === "ko" ? item.titleKo : item.titleEn || item.titleKo
              ).toLowerCase();
              return title.includes(query);
            });
          }
        }

        // 2. Date/Period Filter
        if (period !== "all") {
          const limitDays = period === "7days" ? 7 : 30;
          const cutoffMs = nowMs() - limitDays * 24 * 60 * 60 * 1000;
          items = items.filter((item) => isoToMs(item.postedAt) >= cutoffMs);
        }

        // 3. Sorting Filter
        if (sortBy === "latest") {
          items.sort((a, b) => {
            const pinnedOrder = comparePinnedArticles(a, b);
            if (pinnedOrder !== 0) return pinnedOrder;
            const diff = isoToMs(b.postedAt) - isoToMs(a.postedAt);
            return sortDirection === "desc" ? diff : -diff;
          });
        } else if (sortBy === "views") {
          items.sort((a, b) => {
            const pinnedOrder = comparePinnedArticles(a, b);
            if (pinnedOrder !== 0) return pinnedOrder;
            const diff = (b.viewCount || 0) - (a.viewCount || 0);
            return sortDirection === "desc" ? diff : -diff;
          });
        }

        // 4. Client-side Paginate
        const total = items.length;
        const startIndex = (currentPage - 1) * postsPerPage;
        const paginated = items.slice(startIndex, startIndex + postsPerPage);

        setArticles(paginated);
        setTotalCount(total);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    category,
    currentPage,
    searchQuery,
    searchCriteria,
    sortBy,
    sortDirection,
    period,
    postsPerPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setSearchCriteria("title");
    setSortBy("latest");
    setSortDirection("desc");
    setPeriod("all");
  }, [category]);

  const userPermission = currentUser?.user?.permission ?? 0;
  const writableBoardCodes = useMemo(() => {
    if (!currentUser?.authenticated) return [];

    return boards
      .filter((board) => {
        const requiredPermission = getBoardWritePermissionBitFromMetadata(
          board,
          board.code,
        );
        return (
          requiredPermission === 0 ||
          hasPermission(userPermission, requiredPermission)
        );
      })
      .map((board) => board.code);
  }, [boards, currentUser?.authenticated, userPermission]);
  const canWrite = category
    ? writableBoardCodes.includes(category)
    : writableBoardCodes.length > 0;
  const writeState = category ? { initialCategory: category } : undefined;

  const boardTitle = category
    ? getBoardTitleFromMetadata(currentBoard, category, lang)
    : lang === "ko"
      ? "전체 게시판"
      : "All Boards";

  const boardDescription = category
    ? getBoardDescriptionFromMetadata(currentBoard, category, lang)
    : lang === "ko"
      ? "전산학부의 다양한 소식을 한눈에 확인하세요."
      : "View all updates and news from KAIST School of Computing at a glance.";

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto pb-16">
        {/* PageHero Header */}
        <PageHero title={boardTitle} description={boardDescription} />

        {/* Board Underlined Tabs Navigation & Search block (Spans full width, on same row) */}
        <div className="border-b border-slate-200 bg-white mb-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-2 md:gap-4 select-none">
            {/* Category tabs */}
            <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
              {/* "전체" Tab */}
              <Link to="/board" className="relative group flex items-center">
                <div
                  className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                    !category
                      ? "text-brand-primary font-semibold"
                      : "text-slate-400 hover:text-brand-primary font-medium"
                  }`}
                >
                  <span>{lang === "ko" ? "전체" : "All"}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[3px] bg-brand-primary transition-transform duration-200 origin-center ${
                      !category
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              </Link>

              {boards.map((board) => {
                const isActive = category === board.code;
                return (
                  <Link
                    key={board.code}
                    to={`/board/${board.code}`}
                    className="relative group flex items-center"
                  >
                    <div
                      className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                        isActive
                          ? "text-brand-primary font-semibold"
                          : "text-slate-400 hover:text-brand-primary font-medium"
                      }`}
                    >
                      <span>
                        {getBoardLabelFromMetadata(board, board.code, lang)}
                      </span>
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-[3px] bg-brand-primary transition-transform duration-200 origin-center ${
                          isActive
                            ? "scale-x-100"
                            : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Search, Popover Filter & Write Block aligned on same row */}
            <div className="flex w-full items-center gap-2 pb-2 pt-0 md:w-auto md:shrink-0 md:self-center md:py-0">
              <div className="relative min-w-0 flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    lang === "ko"
                      ? "검색어를 입력하세요..."
                      : "Enter search query..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSearchQuery(e.target.value);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-medium tracking-tight text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 md:w-64"
                />
              </div>

              {/* Advanced Filters Dropdown Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold shadow-sm transition-colors cursor-pointer select-none ${
                    isFilterDropdownOpen
                      ? "border-brand-primary bg-brand-primary-light text-brand-primary"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>{lang === "ko" ? "필터" : "Filter"}</span>
                </button>

                {isFilterDropdownOpen && (
                  <div className="absolute right-0 z-30 mt-2 flex w-72 animate-in select-none flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xl fade-in slide-in-from-top-1 duration-200">
                    {/* Criteria */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        검색 기준
                      </span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {(
                          [
                            { id: "title", label: "제목" },
                            { id: "author", label: "글쓴이" },
                            { id: "title_content", label: "제목+내용" },
                          ] as const
                        ).map((opt) => {
                          const active = searchCriteria === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSearchCriteria(opt.id);
                                setCurrentPage(1);
                              }}
                              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                                active
                                  ? "bg-white text-brand-primary shadow-xs"
                                  : "text-slate-500 hover:text-slate-800 bg-transparent"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Period */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        조회 기간
                      </span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {(
                          [
                            { id: "all", label: "전체" },
                            { id: "7days", label: "최근 7일" },
                            { id: "30days", label: "최근 30일" },
                          ] as const
                        ).map((opt) => {
                          const active = period === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setPeriod(opt.id);
                                setCurrentPage(1);
                              }}
                              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                                active
                                  ? "bg-white text-brand-primary shadow-xs"
                                  : "text-slate-500 hover:text-slate-800 bg-transparent"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Board Content Table */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="bg-white border border-card-border-subtle rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-2 bg-white">
              <div className="text-[14px] font-bold text-slate-800 tracking-tight">
                {lang === "ko" ? (
                  <span>
                    총{" "}
                    <strong className="font-black text-brand-primary">
                      {totalCount}
                    </strong>
                    건
                  </span>
                ) : (
                  <span>
                    <strong className="font-black text-brand-primary">
                      {totalCount}
                    </strong>{" "}
                    posts
                  </span>
                )}
              </div>

              <div className="relative">
                <select
                  value={postsPerPage}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setPostsPerPage(value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200/80 rounded-xl px-4 py-1.5 pr-9 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 cursor-pointer"
                >
                  <option value={10}>
                    {lang === "ko" ? "10건" : "10 per page"}
                  </option>
                  <option value={20}>
                    {lang === "ko" ? "20건" : "20 per page"}
                  </option>
                  <option value={30}>
                    {lang === "ko" ? "30건" : "30 per page"}
                  </option>
                  <option value={50}>
                    {lang === "ko" ? "50건" : "50 per page"}
                  </option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg
                    className="w-3.5 h-3.5 fill-none stroke-current stroke-2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Table Header using CSS Grid with Fractional Middle Track to prevent Overflow */}
            <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_5.25rem] gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3.5 text-[13px] font-bold tracking-tight text-slate-500 md:grid-cols-[8%_1fr_15%_12%_8%] md:gap-4 md:px-6">
              <div className="text-center shrink-0">
                {lang === "ko" ? "말머리" : "Category"}
              </div>
              <div className="min-w-0 text-left md:pl-2">
                {lang === "ko" ? "제목" : "Title"}
              </div>
              <div className="hidden text-center shrink-0 md:block">
                {lang === "ko" ? "글쓴이" : "Author"}
              </div>
              <div className="flex justify-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleSortChange("latest");
                  }}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
                    sortBy === "latest"
                      ? "text-brand-primary"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span>{lang === "ko" ? "작성일" : "Date"}</span>
                  <ArrowDown
                    className={`h-3 w-3 transition-transform ${
                      sortBy === "latest" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>
              </div>
              <div className="hidden justify-end pr-4 shrink-0 md:flex">
                <button
                  type="button"
                  onClick={() => {
                    handleSortChange("views");
                  }}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
                    sortBy === "views"
                      ? "text-brand-primary"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span>{lang === "ko" ? "조회수" : "Views"}</span>
                  <ArrowDown
                    className={`h-3 w-3 transition-transform ${
                      sortBy === "views" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {articles.length > 0 ? (
                articles.map((post) => {
                  const isNew = (() => {
                    return (
                      isoToMs(post.postedAt) >=
                      nowMs() - 4 * 24 * 60 * 60 * 1000
                    );
                  })();
                  const hasAttachment = post.hasAttachment ?? false;

                  const postCategory = post.boardCode || category || "공지";
                  const postBoard = boardByCode.get(postCategory);

                  return (
                    <Link
                      key={post.articleId}
                      to={`/board/${postCategory}/${post.articleId}`}
                      className="group grid grid-cols-[3.75rem_minmax(0,1fr)_5.25rem] items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50/50 md:grid-cols-[8%_1fr_15%_12%_8%] md:gap-4 md:px-6"
                    >
                      {/* Badge / 말머리 */}
                      <div className="flex justify-center text-center shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10.5px] font-bold tracking-tight bg-brand-primary-light text-brand-primary select-none shrink-0">
                          {getBoardLabelFromMetadata(
                            postBoard,
                            postCategory,
                            lang,
                          )}
                        </span>
                      </div>

                      {/* Title / 제목 */}
                      <div className="flex min-w-0 items-center gap-2 text-left text-[14px] font-semibold tracking-tight text-slate-800 transition-colors group-hover:text-brand-primary md:pl-2">
                        {post.isPinned && (
                          <Pin className="h-3.5 w-3.5 shrink-0 fill-[#E11D48] text-[#E11D48]" />
                        )}
                        <span className="truncate">
                          {lang === "ko"
                            ? post.titleKo
                            : post.titleEn || post.titleKo}
                        </span>
                        {isNew && (
                          <span className="bg-[#ffe3e3] text-[#e03131] text-[9px] font-black px-1.5 py-0.2 rounded-sm select-none scale-90 tracking-tighter shrink-0">
                            NEW
                          </span>
                        )}
                        {hasAttachment && (
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                      </div>

                      {/* Author / 글쓴이 */}
                      <div className="hidden text-center text-[13px] font-medium tracking-tight text-slate-600 shrink-0 md:block">
                        {post.isAnonymous
                          ? lang === "ko"
                            ? "익명"
                            : "Anonymous"
                          : post.author.name}
                      </div>

                      {/* Date / 작성일 */}
                      <div className="text-center text-[13px] font-medium tracking-tight text-slate-400 shrink-0">
                        {formatDate(post.postedAt)}
                      </div>

                      {/* Views / 조회수 */}
                      <div className="hidden justify-end pr-4 text-[13px] font-medium tabular-nums tracking-tight text-slate-500 md:flex">
                        <span className="w-12 text-right">{post.viewCount}</span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="py-20 text-center text-slate-400">
                  <p className="text-base font-semibold">
                    {lang === "ko" ? "게시글이 없습니다" : "No posts available"}
                  </p>
                </div>
              )}
            </div>

            {/* Table Footer Controls */}
            <div className="border-t border-slate-200 bg-slate-50/20 px-6 py-4 relative flex items-center justify-center select-none">
              <Pagination
                currentPage={currentPage}
                onPageChange={handlePageChange}
                size="sm"
                totalPages={totalPages}
              />
              {canWrite && (
                <div className="absolute right-6">
                  <Link
                    state={writeState}
                    to="/board/write"
                    className="inline-flex items-center justify-center px-3.5 py-1.5 bg-brand-primary border border-transparent text-white rounded-lg text-[13px] font-bold tracking-tight hover:opacity-90 transition-all shadow-sm"
                  >
                    {lang === "ko" ? "글쓰기" : "Write"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
