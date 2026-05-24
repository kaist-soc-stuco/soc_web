import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ArticleDetailResponse } from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { List, ChevronUp, ChevronDown, Calendar, ArrowRight, Edit2 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";

const BOARD_INFO: Record<string, { descriptionKo: string; descriptionEn: string }> = {
  공지: { descriptionKo: "카이스트 전산학부의 다양한 소식을 알려 드립니다", descriptionEn: "Get updates on various news from KAIST School of Computing" },
  행사: { descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요", descriptionEn: "Discover various events organized by the School of Computing" },
  HoC: { descriptionKo: "Hall of Code 프로젝트 및 활동 내역", descriptionEn: "Hall of Code projects and activity logs" },
  홍보글: { descriptionKo: "집행위원회 및 학회의 홍보 게시물", descriptionEn: "Promotional posts from the Student Council and societies" },
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

function formatDateTimeMinutes(isoString: string) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
}

export function BoardDetailPage() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();

  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const canEdit = useMemo(() => {
    if (!article) return false;
    if (!session || !session.authenticated || !session.userId) return false;
    if (session.userId === article.author.userId) return true;
    const permission = session.permission ?? 0;
    return Permissions.has(permission, Permissions.MANAGE_CONTENT) || Permissions.has(permission, Permissions.ADMIN);
  }, [session, article]);

  const posterAsset = useMemo(() => {
    return article?.assets?.find((a) => a.usageType === "THUMBNAIL" || a.usageType === "IMAGE");
  }, [article]);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    setArticle(null);
    apiClient
      .getArticle(category, articleId)
      .then((res) => {
        setArticle(res);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setLoading(false);
      });
  }, [category, articleId, apiClient]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-kaist-white">
        <Header showLogo={true} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-kaist-grey font-bold">{lang === "ko" ? "불러오는 중..." : "Loading..."}</p>
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col bg-kaist-white">
        <Header showLogo={true} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-red-500 font-bold">{lang === "ko" ? "존재하지 않는 게시글입니다." : "Post not found."}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-kaist-white">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto relative">
        {/* 1. 배너 영역 */}
        <div className="bg-linear-to-r from-kaist-darkgreen to-kaist-lightgreen2 py-12 px-8 relative overflow-hidden">
          <div className="max-w-6xl mx-auto relative z-10">
            <span className="text-sm font-bold text-kaist-white/70 uppercase tracking-widest mb-1 block">
              {lang === "ko" ? category : (CATEGORY_LABELS[category] || category)}
            </span>
            <h1 className="text-3xl font-extrabold text-kaist-white tracking-tight">
              {lang === "ko" ? `${category} 게시판` : `${CATEGORY_LABELS[category] || category} Board`}
            </h1>
            <p className="text-sm text-kaist-white/90 mt-2 font-medium">
              {lang === "ko" 
                ? (BOARD_INFO[category]?.descriptionKo || "") 
                : (BOARD_INFO[category]?.descriptionEn || "")}
            </p>
          </div>
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[150px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 게시글 타이틀 & 글 목록 버튼 */}
        <div className="border-b border-kaist-grey/30 bg-kaist-white px-4 md:px-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between py-6 gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-kaist-black tracking-tight mb-2">
                {lang === "ko" ? article.titleKo : (article.titleEn || article.titleKo)}
              </h2>
              <div className="flex items-center gap-4 text-sm font-medium text-kaist-grey">
                <span className="text-kaist-darkgreen">
                  {article.isAnonymous ? (lang === "ko" ? "익명" : "Anonymous") : article.author.name}
                </span>
                <span>{formatDateTimeMinutes(article.postedAt)}</span>
                <span className="flex items-center gap-1">
                  {lang === "ko" ? "조회수" : "Views"} {article.viewCount}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 self-start md:self-auto">
              {canEdit && (
                <Link
                  to={`/board/${category}/${articleId}/edit`}
                  className="flex items-center gap-2 text-kaist-grey hover:text-kaist-darkgreen transition-colors font-semibold text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  {lang === "ko" ? "수정" : "Edit"}
                </Link>
              )}
              <Link
                to={`/board/${category}`}
                className="flex items-center gap-2 text-kaist-grey hover:text-kaist-darkgreen transition-colors font-semibold text-sm"
              >
                <List className="w-5 h-5" />
                {lang === "ko" ? "글 목록" : "List"}
              </Link>
            </div>
          </div>
        </div>

        {/* 3. 본문 영역 */}
        <div className="max-w-6xl mx-auto px-4 py-12 md:px-8">
          <div className="flex flex-col md:flex-row gap-12">
            {/* 좌측 포스터 영역 */}
            {posterAsset && (
              <div className="w-full md:w-[380px] flex-shrink-0">
                <div className="aspect-[3/4] bg-kaist-grey/10 rounded-lg overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <img
                    src={posterAsset.storageKey}
                    alt="Poster"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            {/* 우측 텍스트 영역 */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="text-base font-medium leading-relaxed text-kaist-black whitespace-pre-line">
                {lang === "ko" ? article.contentKo : (article.contentEn || article.contentKo)}
              </div>
            </div>
          </div>

          {/* 설문조사 임베드 카드 */}
          {article.survey && (
            <section className="mt-16 mb-8 border-t border-kaist-grey/10 pt-16">
              <div className="max-w-4xl mx-auto">
                <div className="relative overflow-hidden rounded-2xl border-2 border-kaist-darkgreen/20 bg-white p-8 shadow-sm transition-all hover:shadow-md">
                  
                  {/* 배경 장식 */}
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-kaist-darkgreen/5 pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-3">
                      {/* 상태 뱃지 */}
                      <div className="flex items-center gap-2">
                        <span className={`flex h-2 w-2 rounded-full ${article.survey.computedState === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span className={`text-xs font-bold tracking-wider uppercase ${article.survey.computedState === 'open' ? 'text-green-600' : 'text-gray-500'}`}>
                          {article.survey.computedState === 'open' 
                            ? (lang === "ko" ? "진행 중" : "Ongoing") 
                            : article.survey.computedState === 'before_open' 
                              ? (lang === "ko" ? "예정" : "Upcoming") 
                              : (lang === "ko" ? "마감" : "Closed")}
                        </span>
                      </div>

                      {/* 제목 및 설명 */}
                      <h3 className="text-xl font-extrabold text-kaist-black tracking-tight">
                        {lang === "ko" ? article.survey.titleKo : (article.survey.titleEn || article.survey.titleKo)}
                      </h3>
                      <p className="text-sm font-medium text-kaist-grey leading-relaxed max-w-lg">
                        {lang === "ko" 
                          ? (article.survey.descriptionKo)
                          : (article.survey.descriptionEn || article.survey.descriptionKo)}
                      </p>

                      {/* 기간 안내 정보 */}
                      <div className="flex items-center gap-4 text-xs font-semibold text-kaist-grey/80">
                        {article.survey.closeAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {lang === "ko" 
                                ? `마감: ${formatDateTimeMinutes(article.survey.closeAt)} 까지`
                                : `Deadline: until ${formatDateTimeMinutes(article.survey.closeAt)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 버튼 영역 */}
                    <div className="flex-shrink-0">
                      <Link
                        to={`/survey/${article.survey.surveyId}`}
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-kaist-darkgreen text-white rounded-xl font-bold text-base shadow-lg shadow-kaist-darkgreen/20 hover:bg-opacity-90 hover:-translate-y-0.5 transition-all"
                      >
                        {lang === "ko" ? "설문 참여하기" : "Take Survey"}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* 4. 하단 이전글 / 다음글 네비게이션 */}
        <div className="max-w-6xl mx-auto px-4 pb-20 md:px-8">
          <div className="border-t-2 border-kaist-grey/30 divide-y divide-kaist-grey/20">
            
            {/* 이전글 */}
            {article.prevArticle && (
              <Link 
                to={`/board/${category}/${article.prevArticle.articleId}`} 
                className="flex flex-col sm:flex-row sm:items-center py-4 hover:bg-kaist-grey/5 transition-colors group"
              >
                <div className="flex items-center gap-4 sm:w-32 font-semibold text-kaist-grey group-hover:text-kaist-black transition-colors">
                  <ChevronUp className="w-5 h-5" />
                  {lang === "ko" ? "이전글" : "Prev"}
                </div>
                <div className="flex-1 mt-2 sm:mt-0 font-semibold text-kaist-black truncate pr-4">
                  {article.prevArticle.titleKo}
                </div>
                <div className="flex items-center gap-6 text-sm font-semibold text-kaist-grey mt-2 sm:mt-0">
                  <span>{new Date(article.prevArticle.postedAt).toLocaleDateString()}</span>
                  <span className="w-12 text-right">
                    {article.prevArticle.isAnonymous ? (lang === "ko" ? "익명" : "Anonymous") : article.prevArticle.author.name}
                  </span>
                </div>
              </Link>
            )}

            {/* 다음글 */}
            {article.nextArticle && (
              <Link 
                to={`/board/${category}/${article.nextArticle.articleId}`} 
                className="flex flex-col sm:flex-row sm:items-center py-4 hover:bg-kaist-grey/5 transition-colors group border-b border-kaist-grey/20"
              >
                <div className="flex items-center gap-4 sm:w-32 font-semibold text-kaist-grey group-hover:text-kaist-black transition-colors">
                  <ChevronDown className="w-5 h-5" />
                  {lang === "ko" ? "다음글" : "Next"}
                </div>
                <div className="flex-1 mt-2 sm:mt-0 font-semibold text-kaist-black truncate pr-4">
                  {article.nextArticle.titleKo}
                </div>
                <div className="flex items-center gap-6 text-sm font-semibold text-kaist-grey mt-2 sm:mt-0">
                  <span>{new Date(article.nextArticle.postedAt).toLocaleDateString()}</span>
                  <span className="w-12 text-right">
                    {article.nextArticle.isAnonymous ? (lang === "ko" ? "익명" : "Anonymous") : article.nextArticle.author.name}
                  </span>
                </div>
              </Link>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}