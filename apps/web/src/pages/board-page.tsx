import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { CurrentUserResponse, ArticleListItem } from "@soc/contracts";
import { hasPermission } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { ChevronLeft, ChevronRight, Search, Filter, Paperclip } from "lucide-react";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { PageHero } from "@/components/organisms/page-hero";

const BOARDS = [
  "공지",
  "행사",
  "HoC",
  "홍보글",
  "건의사항",
  "연구실",
  "QnA",
] as const;
type BoardType = (typeof BOARDS)[number];

const BOARD_WRITE_PERMISSION: Record<BoardType, number> = {
  공지: 1,
  행사: 1,
  HoC: 2,
  홍보글: 2,
  건의사항: 0,
  연구실: 4,
  QnA: 16,
};

const BOARD_INFO: Record<string, { descriptionKo: string; descriptionEn: string }> = {
  공지: { descriptionKo: "집행위원회 및 학교의 중요한 공지사항을 확인하세요.", descriptionEn: "Check out important notices from the Student Council and school" },
  행사: { descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요.", descriptionEn: "Discover various events organized by the School of Computing" },
  HoC: { descriptionKo: "Hall of Code 프로젝트 및 활동 내역을 확인하세요.", descriptionEn: "Hall of Code projects and activity logs" },
  홍보글: { descriptionKo: "집행위원회 및 학회의 홍보 게시물을 확인하세요.", descriptionEn: "Promotional posts from the Student Council and societies" },
  건의사항: { descriptionKo: "학생들의 의견 and 건의사항을 나눠주세요.", descriptionEn: "Share your opinions and suggestions with us" },
  연구실: { descriptionKo: "각 연구실의 소식과 공지사항을 확인하세요.", descriptionEn: "News and announcements from research labs" },
  QnA: { descriptionKo: "궁금한 점을 자유롭게 질문하세요.", descriptionEn: "Ask questions and get answers freely" },
};

const CATEGORY_LABELS: Record<string, string> = {
  공지: "Notice",
  행사: "Event",
  HoC: "HoC",
  홍보글: "Promo",
  건의사항: "Suggestions",
  연구실: "Labs",
  QnA: "QnA",
};

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export function BoardPage() {
  const { category = "공지" } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();

  // Advanced filter states
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<"title" | "author" | "title_content">("title");
  const [sortBy, setSortBy] = useState<"latest" | "views">("latest");
  const [period, setPeriod] = useState<"all" | "7days" | "30days">("all");
  
  // Page size option
  const [postsPerPage, setPostsPerPage] = useState(10);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const totalPages = Math.ceil(totalCount / postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generate page items exactly as `< 1 2 3 4 5 ... 13 >`
  const getPaginationItems = () => {
    const items: (number | string)[] = [];
    const total = totalPages || 1;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        items.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          items.push(i);
        }
        items.push("...");
        items.push(total);
      } else if (currentPage >= total - 3) {
        items.push(1);
        items.push("...");
        for (let i = total - 4; i <= total; i++) {
          items.push(i);
        }
      } else {
        items.push(1);
        items.push("...");
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push("...");
        items.push(total);
      }
    }
    return items;
  };

  useEffect(() => {
    let cancelled = false;

    // Call standard q-parameter if matching title only, otherwise perform dynamic client filters
    const queryParam = searchCriteria === "title" ? searchQuery : "";
    apiClient.getArticles(category, { page: 1, limit: 100, q: queryParam }).then((data) => {
      if (!cancelled) {
        let items = [...data.items];

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
              const title = (lang === "ko" ? item.titleKo : (item.titleEn || item.titleKo)).toLowerCase();
              return title.includes(query);
            });
          }
        }

        // 2. Date/Period Filter
        if (period !== "all") {
          const now = new Date();
          const limitDays = period === "7days" ? 7 : 30;
          const cutoff = new Date(now.getTime() - limitDays * 24 * 60 * 60 * 1000);
          items = items.filter((item) => new Date(item.postedAt) >= cutoff);
        }

        // 3. Sorting Filter
        if (sortBy === "latest") {
          items.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
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
  }, [apiClient, category, currentPage, searchQuery, searchCriteria, sortBy, period, postsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setSearchCriteria("title");
    setSortBy("latest");
    setPeriod("all");
  }, [category]);

  const requiredPermission = BOARD_WRITE_PERMISSION[category as BoardType] ?? 0;
  const userPermission = currentUser?.user?.permission ?? 0;
  const canWrite =
    Boolean(currentUser?.authenticated) &&
    (requiredPermission === 0 ||
      hasPermission(userPermission, requiredPermission));

  const boardTitle = category === "공지" ? "공지사항" : `${category} 게시판`;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto pb-16">
        {/* PageHero Header */}
        <PageHero
          title={lang === "ko" ? boardTitle : `${CATEGORY_LABELS[category] || category} Board`}
          description={lang === "ko"
            ? (BOARD_INFO[category]?.descriptionKo || "")
            : (BOARD_INFO[category]?.descriptionEn || "")}
        />

        {/* Board Underlined Tabs Navigation & Search block (Spans full width, on same row) */}
        <div className="border-b border-slate-200 bg-white mb-8">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-4 select-none">
            {/* Category tabs */}
            <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
              {BOARDS.map((board) => {
                const isActive = category === board;
                return (
                  <Link
                    key={board}
                    to={`/board/${board}`}
                    className="relative group flex items-center"
                  >
                    <div
                      className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] font-bold tracking-tight transition-all py-4 cursor-pointer ${
                        isActive
                          ? "text-kaist-darkgreen"
                          : "text-slate-400 hover:text-kaist-darkgreen"
                      }`}
                    >
                      <span>
                        {lang === "ko" ? board : (CATEGORY_LABELS[board] || board)}
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
                  placeholder={lang === "ko" ? "검색어를 입력하세요..." : "Enter search query..."}
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">검색 기준</span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {[
                          { id: "title", label: "제목" },
                          { id: "author", label: "글쓴이" },
                          { id: "title_content", label: "제목+내용" }
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">정렬 기준</span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {[
                          { id: "latest", label: "최신순" },
                          { id: "views", label: "조회수순" }
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">조회 기간</span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
                        {[
                          { id: "all", label: "전체" },
                          { id: "7days", label: "최근 7일" },
                          { id: "30days", label: "최근 30일" }
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

              {canWrite && (
                <Link
                  to={`/board/${category}/write`}
                  className="inline-flex items-center justify-center px-3.5 py-1.5 bg-kaist-darkgreen border border-transparent text-white rounded-lg text-[13px] font-bold tracking-tight hover:opacity-90 transition-all shadow-sm"
                >
                  {lang === "ko" ? "글쓰기" : "Write"}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Board Content Table */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
            {/* Table Header using CSS Grid with Fractional Middle Track to prevent Overflow */}
            <div className="grid grid-cols-[12%_1fr_15%_12%_8%] gap-4 py-3.5 px-6 border-b border-slate-200 font-bold text-[13px] tracking-tight text-slate-500 bg-slate-50/50 items-center">
              <div className="text-center shrink-0">{lang === "ko" ? "말머리" : "Category"}</div>
              <div className="text-left pl-6 shrink-0">{lang === "ko" ? "제목" : "Title"}</div>
              <div className="text-center shrink-0">{lang === "ko" ? "글쓴이" : "Author"}</div>
              <div className="text-center shrink-0">{lang === "ko" ? "작성일" : "Date"}</div>
              <div className="text-center shrink-0">{lang === "ko" ? "조회수" : "Views"}</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {articles.length > 0 ? (
                articles.map((post) => {
                  const isNew = post.articleId === "mock-1" || post.articleId === "mock-6" || post.titleKo.includes("서버") || post.titleKo.includes("공개 모집") || post.titleKo.includes("변경 안내");
                  const hasAttachment = post.titleKo.includes("서버") || post.titleKo.includes("공개 모집") || post.titleKo.includes("Fellowship") || post.titleKo.includes("이용 안내");

                  return (
                    <Link
                      key={post.articleId}
                      to={`/board/${category}/${post.articleId}`}
                      className="grid grid-cols-[12%_1fr_15%_12%_8%] gap-4 py-4 px-6 items-center transition-colors group hover:bg-slate-50/50"
                    >
                      {/* Badge / 말머리 */}
                      <div className="flex justify-center text-center shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight bg-[#e6f4ea] text-[#137333] select-none shrink-0">
                          {lang === "ko" ? category : (CATEGORY_LABELS[category] || category)}
                        </span>
                      </div>
                      
                      {/* Title / 제목 */}
                      <div className="flex items-center gap-2 pl-6 text-left font-semibold text-[14px] tracking-tight text-slate-800 group-hover:text-kaist-darkgreen transition-colors truncate shrink-0">
                        <span className="truncate">{lang === "ko" ? post.titleKo : (post.titleEn || post.titleKo)}</span>
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
                        {post.isAnonymous ? (lang === "ko" ? "익명" : "Anonymous") : post.author.name}
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
                  <p className="text-base font-semibold">{lang === "ko" ? "게시글이 없습니다" : "No posts available"}</p>
                </div>
              )}
            </div>

            {/* Table Footer Controls (Inside the Card, separated by a bottom bar) */}
            <div className="border-t border-slate-200 bg-slate-50/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
              {/* Total count */}
              <div className="text-[13px] font-medium text-slate-500">
                {lang === "ko" ? (
                  <span>총 <strong className="text-[#137333] font-bold">{totalCount}</strong>건의 게시물이 있습니다.</span>
                ) : (
                  <span>Total <strong className="text-[#137333] font-bold">{totalCount}</strong> posts.</span>
                )}
              </div>

              {/* High-Fidelity Pagination Controls (Sitting directly in card footer, not in a border wrapper) */}
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                    currentPage === 1
                      ? "bg-white border-slate-100 text-slate-300 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-sm"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4 stroke-[2.5px]" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1.5">
                  {getPaginationItems().map((item, idx) => {
                    if (item === "...") {
                      return (
                        <span key={`dots-${idx}`} className="text-slate-400 text-xs px-1.5 select-none">
                          ...
                        </span>
                      );
                    }
                    const page = item as number;
                    const isActive = currentPage === page;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-8 h-8 rounded-lg text-[13px] font-bold tracking-tight transition-all flex items-center justify-center cursor-pointer ${
                          isActive
                            ? "bg-kaist-darkgreen text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-800"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(Math.min(totalPages || 1, currentPage + 1))}
                  disabled={currentPage === (totalPages || 1)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                    currentPage === (totalPages || 1)
                      ? "bg-white border-slate-100 text-slate-300 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-sm"
                  }`}
                >
                  <ChevronRight className="h-4 w-4 stroke-[2.5px]" />
                </button>
              </div>

              {/* View n at a time Dropdown */}
              <div className="relative">
                <select 
                  value={postsPerPage} 
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setPostsPerPage(value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200/80 rounded-xl px-4 py-2 pr-9 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 cursor-pointer"
                >
                  <option value={10}>{lang === "ko" ? "10개씩 보기" : "10 per page"}</option>
                  <option value={20}>{lang === "ko" ? "20개씩 보기" : "20 per page"}</option>
                  <option value={30}>{lang === "ko" ? "30개씩 보기" : "30 per page"}</option>
                  <option value={50}>{lang === "ko" ? "50개씩 보기" : "50 per page"}</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
