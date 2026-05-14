import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ArticleDetailResponse } from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { List, ChevronUp, ChevronDown, Calendar, ArrowRight } from "lucide-react";

const BOARD_INFO: Record<string, { description: string }> = {
  공지: { description: "카이스트 전산학부의 다양한 소식을 알려 드립니다" },
  행사: { description: "전산학부의 다양한 행사 정보를 확인하세요" },
  HoC: { description: "Hall of Code 프로젝트 및 활동 내역" },
  홍보글: { description: "학생회 및 학회의 홍보 게시물" },
  건의사항: { description: "학생들의 의견과 건의사항을 나눠주세요" },
  연구실: { description: "각 연구실의 소식과 공지사항" },
  QnA: { description: "궁금한 점을 자유롭게 질문하세요" },
};

export function BoardDetailPage() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();

  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    apiClient.getArticle(category, articleId)
      .then(data => setArticle(data))
      .catch(err => console.error("Failed to load article:", err))
      .finally(() => setLoading(false));
  }, [category, articleId, apiClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-kaist-white flex flex-col items-center justify-center">
        <Header showLogo />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-kaist-grey font-semibold">게시글을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-kaist-white flex flex-col items-center justify-center">
        <Header showLogo />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-kaist-grey font-semibold">게시글을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const posterAsset = article.assets?.find(a => a.usageType === "THUMBNAIL");

  return (
    <div className="min-h-screen bg-kaist-white flex flex-col">
      <Header showLogo />

      <main className="flex-1 w-full mx-auto">
        {/* 1. 상단 배너 영역 */}
        <div className="relative overflow-hidden bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 py-12 px-4 md:px-8">
          <div className="max-w-6xl mx-auto relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-kaist-white mb-2">
              {category} 게시판
            </h1>
            <p className="text-sm font-semibold tracking-tight text-kaist-white/90">
              {BOARD_INFO[category]?.description || "전산학부의 다양한 소식을 알려 드립니다"}
            </p>
          </div>
          {/* 우측 KAIST 워터마크 로고 느낌 */}
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[150px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 게시글 타이틀 & 글 목록 버튼 */}
        <div className="border-b border-kaist-grey/30 bg-kaist-white px-4 md:px-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between py-6">
            <h2 className="text-2xl font-extrabold text-kaist-black tracking-tight">
              {article.titleKo}
            </h2>
            <Link
              to={`/board/${category}`}
              className="flex items-center gap-2 text-kaist-grey hover:text-kaist-darkgreen transition-colors font-semibold text-sm"
            >
              <List className="w-5 h-5" />
              글 목록
            </Link>
          </div>
        </div>

        {/* 3. 본문 영역 (좌측 포스터 + 우측 텍스트) */}
        <div className="max-w-6xl mx-auto px-4 py-12 md:px-8">
          <div className="flex flex-col md:flex-row gap-12">
            {/* 좌측 포스터 영역 */}
            {posterAsset && (
              <div className="w-full md:w-[380px] flex-shrink-0">
                <div className="aspect-[3/4] bg-kaist-grey/10 rounded-lg overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <img
                    src={posterAsset.storageKey}
                    alt="포스터"
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
              <h3 className="text-xl font-extrabold text-kaist-black tracking-tight">
                {article.titleEn}
              </h3>
              <div className="text-base font-medium leading-relaxed text-kaist-black whitespace-pre-line">
                {article.contentKo}
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
                          {article.survey.computedState === 'open' ? '진행 중인 설문' : 
                           article.survey.computedState === 'before_open' ? '진행 예정 설문' : '종료된 설문'}
                        </span>
                      </div>

                      {/* 제목 및 설명 */}
                      <h3 className="text-xl font-extrabold text-kaist-black tracking-tight">
                        {article.survey.titleKo}
                      </h3>
                      <p className="text-sm font-medium text-kaist-grey leading-relaxed max-w-lg">
                        {article.survey.descriptionKo || "본 게시글과 연관된 설문조사입니다. 학우 여러분의 많은 참여 부탁드립니다."}
                      </p>

                      {/* 기간 안내 정보 */}
                      <div className="flex items-center gap-4 text-xs font-semibold text-kaist-grey/80">
                        {article.survey.closeAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>마감: {new Date(article.survey.closeAt).toLocaleString('ko-KR')} 까지</span>
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
                        설문 참여하기
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* 안내 문구 */}
                  <div className="mt-6 pt-5 border-t border-kaist-grey/10">
                    <p className="text-[11px] text-kaist-grey/60 font-medium italic">
                      * 본 설문조사는 게시글 내용과 연관된 공식 설문입니다. 중복 참여는 불가하며, 작성된 내용은 학생회 운영의 기초 자료로 활용됩니다.
                    </p>
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
            {/* TODO: 이전글 ID로 라우팅 연결 */}
            <Link 
              to={`/board/${category}`} 
              className="flex flex-col sm:flex-row sm:items-center py-4 hover:bg-kaist-grey/5 transition-colors group"
            >
              <div className="flex items-center gap-4 sm:w-32 font-semibold text-kaist-grey group-hover:text-kaist-black transition-colors">
                <ChevronUp className="w-5 h-5" />
                이전글
              </div>
              <div className="flex-1 mt-2 sm:mt-0 font-semibold text-kaist-black truncate pr-4">
                이전 제목이 들어가는 공간입니다
              </div>
              <div className="flex items-center gap-6 text-sm font-semibold text-kaist-grey mt-2 sm:mt-0">
                <span>26.04.27</span>
                <span className="w-12 text-right">변희승</span>
              </div>
            </Link>

            {/* 다음글 */}
            {/* TODO: 다음글 ID로 라우팅 연결 */}
            <Link 
              to={`/board/${category}`} 
              className="flex flex-col sm:flex-row sm:items-center py-4 hover:bg-kaist-grey/5 transition-colors group border-b border-kaist-grey/20"
            >
              <div className="flex items-center gap-4 sm:w-32 font-semibold text-kaist-grey group-hover:text-kaist-black transition-colors">
                <ChevronDown className="w-5 h-5" />
                다음글
              </div>
              <div className="flex-1 mt-2 sm:mt-0 font-semibold text-kaist-black truncate pr-4">
                다음 제목이 들어가는 공간입니다
              </div>
              <div className="flex items-center gap-6 text-sm font-semibold text-kaist-grey mt-2 sm:mt-0">
                <span>26.04.27</span>
                <span className="w-12 text-right">김서호</span>
              </div>
            </Link>
            
          </div>
        </div>
      </main>
    </div>
  );
}