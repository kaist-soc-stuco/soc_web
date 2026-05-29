import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { CurrentUserResponse, ArticleListItem } from "@soc/contracts";
import { hasPermission } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { Search, Filter, Paperclip } from "lucide-react";
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

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
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
  const [searchCriteria, setSearchCriteria] = useState<
    "title" | "author" | "title_content"
  >("title");
  const [sortBy, setSortBy] = useState<"latest" | "views">("latest");
  const [period, setPeriod] = useState<"all" | "7days" | "30days">("all");

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
        });

    fetchPromise.then((data) => {
      if (!cancelled) {
        let items = [...data.items];

        if (!category) {
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
          const now = new Date();
          const limitDays = period === "7days" ? 7 : 30;
          const cutoff = new Date(
            now.getTime() - limitDays * 24 * 60 * 60 * 1000,
          );
          items = items.filter((item) => new Date(item.postedAt) >= cutoff);
        }

        // 3. Sorting Filter
        if (sortBy === "latest") {
          items.sort(
            (a, b) =>
              new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
          );
        } else if (sortBy === "views") {
          items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
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
    period,
    postsPerPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setSearchCriteria("title");
    setSortBy("latest");
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
  const writeHref = category ? `/board/${category}/write` : "/board/write";

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
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-4 select-none">
            {/* Category tabs */}
            <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
              {/* "전체" Tab */}
              <Link to="/board" className="relative group flex items-center">
                <div
                  className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                    !category
                      ? "text-kaist-darkgreen font-semibold"
                      : "text-slate-400 hover:text-kaist-darkgreen font-medium"
                  }`}
                >
                  <span>{lang === "ko" ? "전체" : "All"}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
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
                          ? "text-kaist-darkgreen font-semibold"
                          : "text-slate-400 hover:text-kaist-darkgreen font-medium"
                      }`}
                    >
                      <span>
                        {getBoardLabelFromMetadata(board, board.code, lang)}
                      </span>
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
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
            <div className="flex items-center gap-2 py-2 md:py-0 shrink-0 self-center">
              <div className="relative">
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
                  className="pl-9 pr-3 py-1.5 w-64 rounded-lg border border-slate-200 bg-white text-[13px] font-medium tracking-tight text-slate-800 shadow-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 transition-colors placeholder:text-slate-400"
                />
              </div>

              {/* Advanced Filters Dropdown Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-semibold transition-colors shadow-sm cursor-pointer select-none ${
                    isFilterDropdownOpen
                      ? "border-kaist-darkgreen bg-[#e6f4ea]/40 text-kaist-darkgreen"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>{lang === "ko" ? "필터" : "Filter"}</span>
                </button>

                {isFilterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 z-30 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-1 duration-200 select-none">
                    {/* Criteria */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        검색 기준
                      </span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {[
                          { id: "title", label: "제목" },
                          { id: "author", label: "글쓴이" },
                          { id: "title_content", label: "제목+내용" },
                        ].map((opt) => {
                          const active = searchCriteria === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSearchCriteria(opt.id as any);
                                setCurrentPage(1);
                              }}
                              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                                active
                                  ? "bg-white text-kaist-darkgreen shadow-xs"
                                  : "text-slate-500 hover:text-slate-800 bg-transparent"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sorting */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        정렬 기준
                      </span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {[
                          { id: "latest", label: "최신순" },
                          { id: "views", label: "조회수순" },
                        ].map((opt) => {
                          const active = sortBy === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setSortBy(opt.id as any);
                                setCurrentPage(1);
                              }}
                              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                                active
                                  ? "bg-white text-kaist-darkgreen shadow-xs"
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
                        {[
                          { id: "all", label: "전체" },
                          { id: "7days", label: "최근 7일" },
                          { id: "30days", label: "최근 30일" },
                        ].map((opt) => {
                          const active = period === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setPeriod(opt.id as any);
                                setCurrentPage(1);
                              }}
                              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                                active
                                  ? "bg-white text-kaist-darkgreen shadow-xs"
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
          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-2 bg-white">
              <div className="text-[14px] font-bold text-slate-800 tracking-tight">
                {lang === "ko" ? (
                  <span>
                    총{" "}
                    <strong className="font-black text-kaist-darkgreen">
                      {totalCount}
                    </strong>
                    건
                  </span>
                ) : (
                  <span>
                    <strong className="font-black text-kaist-darkgreen">
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
                  className="appearance-none bg-white border border-slate-200/80 rounded-xl px-4 py-1.5 pr-9 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 cursor-pointer"
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
            <div className="grid grid-cols-[12%_1fr_15%_12%_8%] gap-4 py-3.5 px-6 border-b border-slate-200 font-bold text-[13px] tracking-tight text-slate-500 bg-slate-50/50 items-center">
              <div className="text-center shrink-0">
                {lang === "ko" ? "말머리" : "Category"}
              </div>
              <div className="text-left pl-6 shrink-0">
                {lang === "ko" ? "제목" : "Title"}
              </div>
              <div className="text-center shrink-0">
                {lang === "ko" ? "글쓴이" : "Author"}
              </div>
              <div className="text-center shrink-0">
                {lang === "ko" ? "작성일" : "Date"}
              </div>
              <div className="text-center shrink-0">
                {lang === "ko" ? "조회수" : "Views"}
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {articles.length > 0 ? (
                articles.map((post) => {
                  const isNew = (() => {
                    const postDate = new Date(post.postedAt);
                    const now = new Date();
                    const fourDaysAgo = new Date();
                    fourDaysAgo.setDate(now.getDate() - 4);
                    return postDate >= fourDaysAgo;
                  })();
                  const hasAttachment = post.hasAttachment ?? false;

                  const postCategory =
                    post.boardCode ||
                    (post as any).categoryCode ||
                    category ||
                    "공지";
                  const postBoard = boardByCode.get(postCategory);

                  return (
                    <Link
                      key={post.articleId}
                      to={`/board/${postCategory}/${post.articleId}`}
                      className="grid grid-cols-[12%_1fr_15%_12%_8%] gap-4 py-4 px-6 items-center transition-colors group hover:bg-slate-50/50"
                    >
                      {/* Badge / 말머리 */}
                      <div className="flex justify-center text-center shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight bg-[#e6f4ea] text-[#137333] select-none shrink-0">
                          {getBoardLabelFromMetadata(
                            postBoard,
                            postCategory,
                            lang,
                          )}
                        </span>
                      </div>

                      {/* Title / 제목 */}
                      <div className="flex items-center gap-2 pl-6 text-left font-semibold text-[14px] tracking-tight text-slate-800 group-hover:text-kaist-darkgreen transition-colors truncate shrink-0">
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
                      <div className="text-center text-[13px] font-medium tracking-tight text-slate-600 shrink-0">
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
                      <div className="text-center text-[13px] font-semibold tracking-tight text-slate-500 shrink-0">
                        {post.viewCount}
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
                    to={writeHref}
                    className="inline-flex items-center justify-center px-3.5 py-1.5 bg-kaist-darkgreen border border-transparent text-white rounded-lg text-[13px] font-bold tracking-tight hover:opacity-90 transition-all shadow-sm"
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
