import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { CurrentUserResponse, ArticleListItem } from "@soc/contracts";
import { hasPermission } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { PageHero } from "@/components/organisms/page-hero";

interface Event {
  id: number;
  title: string;
  date: string;
  image: string;
}

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
  공지: { descriptionKo: "학생회 및 학교의 중요한 공지사항을 확인하세요", descriptionEn: "Check out important notices from the Student Council and school" },
  행사: { descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요", descriptionEn: "Discover various events organized by the School of Computing" },
  HoC: { descriptionKo: "Hall of Code 프로젝트 및 활동 내역", descriptionEn: "Hall of Code projects and activity logs" },
  홍보글: { descriptionKo: "학생회 및 학회의 홍보 게시물", descriptionEn: "Promotional posts from the Student Council and societies" },
  건의사항: { descriptionKo: "학생들의 의견과 건의사항을 나눠주세요", descriptionEn: "Share your opinions and suggestions with us" },
  연구실: { descriptionKo: "각 연구실의 소식과 공지사항", descriptionEn: "News and announcements from research labs" },
  QnA: { descriptionKo: "궁금한 점을 자유롭게 질문하세요", descriptionEn: "Ask questions and get answers freely" },
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

export function BoardPage() {
  const { category = "공지" } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(
    null,
  );
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const postsPerPage = 10;
  const totalPages = Math.ceil(totalCount / postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = () => {
    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

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

  useEffect(() => {
    let cancelled = false;

    apiClient.getArticles(category, { page: currentPage, limit: postsPerPage, q: searchQuery }).then((data) => {
      if (!cancelled) {
        setArticles(data.items);
        setTotalCount(data.total);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiClient, category, currentPage, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
  }, [category]);

  const requiredPermission = BOARD_WRITE_PERMISSION[category as BoardType] ?? 0;
  const userPermission = currentUser?.user?.permission ?? 0;
  const canWrite =
    Boolean(currentUser?.authenticated) &&
    (requiredPermission === 0 ||
      hasPermission(userPermission, requiredPermission));

  return (
    <div className="min-h-screen flex flex-col bg-kaist-white">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto">
        <PageHero
          title={lang === "ko" ? `${category} 게시판` : `${CATEGORY_LABELS[category] || category} Board`}
          description={lang === "ko"
            ? (BOARD_INFO[category]?.descriptionKo || "")
            : (BOARD_INFO[category]?.descriptionEn || "")}
        />

        {/* Board Tabs */}
        <div className="border-b-2 border-kaist-grey/30 bg-kaist-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-stretch justify-between gap-8">
              <div className="flex flex-wrap items-stretch gap-8">
                {BOARDS.map((board, index) => (
                  <Link
                    key={board}
                    to={`/board/${board}`}
                    className="relative group"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div
                      className={`relative flex items-center justify-center h-full text-lg font-extrabold tracking-tight transition-colors ${category === board
                        ? "text-kaist-darkgreen"
                        : "text-kaist-greygreen hover:text-kaist-darkgreen"
                        }`}
                    >
                      <span className="py-4">
                        {lang === "ko" ? board : (CATEGORY_LABELS[board] || board)}
                      </span>
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${category === board
                          ? "scale-x-100"
                          : hoveredIndex === index
                            ? "scale-x-100"
                            : "scale-x-0"
                          }`}
                      />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center">
                <div className="relative ml-2 md:ml-4">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-kaist-grey" />
                  <input
                    type="text"
                    placeholder={lang === "ko" ? "검색..." : "Search..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setSearchQuery(e.target.value);
                    }}
                    className="pl-10 pr-4 py-2.5 w-72 rounded-lg border border-kaist-grey/35 bg-white text-sm font-medium tracking-tight text-kaist-black shadow-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto pb-16">
          <div className="flex gap-6">
            {/* Board List */}
            <div className="flex-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 py-4 bg-kaist-white border-b-2 border-kaist-darkgreen-main font-extrabold text-sm tracking-tight text-kaist-darkgreen">
                <div className="col-span-1 text-center">{lang === "ko" ? "번호" : "No."}</div>
                <div className="col-span-1 text-center">{lang === "ko" ? "분류" : "Category"}</div>
                <div className="col-span-7 text-center">{lang === "ko" ? "제목" : "Title"}</div>
                <div className="col-span-1 text-center">{lang === "ko" ? "글쓴이" : "Author"}</div>
                <div className="col-span-1 text-center">{lang === "ko" ? "작성일" : "Date"}</div>
                <div className="col-span-1 text-center">{lang === "ko" ? "댓글" : "Replies"}</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
                {articles.length > 0 ? (
                  articles.map((post) => (
                    <Link
                      key={post.articleId}
                      to={`/board/${category}/${post.articleId}`}
                      className="grid grid-cols-12 gap-4 py-4 px-3 rounded-2xl transition-colors group hover:bg-kaist-darkgreen/5"
                    >
                      <div className="col-span-1 grid place-content-center text-center text-sm font-semibold text-kaist-grey">
                        {post.articleId}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-tight bg-kaist-darkgreen text-kaist-white">
                          {lang === "ko" ? category : (CATEGORY_LABELS[category] || category)}
                        </span>
                      </div>
                      <div className="col-span-7 flex ml-8 items-center text-left text-sm font-bold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">
                        <span className="truncate">{lang === "ko" ? post.titleKo : (post.titleEn || post.titleKo)}</span>
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-sm font-medium tracking-tight text-kaist-grey/80">
                        {post.isAnonymous ? (lang === "ko" ? "익명" : "Anonymous") : post.author.name}
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey/70">
                        {new Date(post.postedAt).toLocaleDateString()}
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey/70">
                        {post.commentCount}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-20 text-center text-kaist-grey">
                    <p className="text-base font-semibold">{lang === "ko" ? "게시글이 없습니다" : "No posts available"}</p>
                  </div>
                )}
              </div>

              {/* Pagination + Write Button */}
              <div className="mt-8 flex items-center justify-center relative">
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className={`p-1 rounded-md transition-colors ${currentPage === 1
                        ? "text-kaist-grey/30 cursor-not-allowed"
                        : "text-kaist-darkgreen hover:bg-kaist-grey/10"
                        }`}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {getPageNumbers().map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`min-w-10 h-10 px-3 rounded-md text-sm font-semibold tracking-tight transition-colors ${currentPage === page
                          ? "bg-kaist-darkgreen text-kaist-white"
                          : "text-kaist-greygreen hover:bg-kaist-grey/10"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-md transition-colors ${currentPage === totalPages
                        ? "text-kaist-grey/30 cursor-not-allowed"
                        : "text-kaist-darkgreen hover:bg-kaist-grey/10"
                        }`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
                {canWrite && (
                  <Link
                    to={`/board/${category}/write`}
                    className="absolute right-0 px-6 py-2 bg-kaist-white border border-kaist-darkgreen text-kaist-darkgreen rounded-sm text-sm font-extrabold tracking-tight hover:bg-kaist-darkgreen hover:text-kaist-white transition-colors"
                  >
                    {lang === "ko" ? "글쓰기" : "Write"}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
