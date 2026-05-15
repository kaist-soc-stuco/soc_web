import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { 
  CurrentUserResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MySurveyResponseListResponse,
} from "@soc/contracts";

import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useCurrentSession } from "@/hooks/use-current-session";

type Tab = "info" | "posts" | "comments" | "activities";

export function MyPage() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session } = useCurrentSession();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");

  const [articles, setArticles] = useState<MyArticleListResponse | null>(null);
  const [comments, setComments] = useState<MyCommentListResponse | null>(null);
  const [activities, setActivities] = useState<MySurveyResponseListResponse | null>(null);

  // 세션 인증 상태에 따라 사용자 정보 조회
  useEffect(() => {
    if (!session?.authenticated) return;
    
    let cancelled = false;
    apiClient
      .getCurrentUser()
      .then((res) => {
        if (!cancelled) {
          setUser(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;
    let cancelled = false;

    if (activeTab === "posts" && !articles) {
      apiClient.getMyArticles().then(res => { if (!cancelled) setArticles(res); }).catch(console.error);
    }
    if (activeTab === "comments" && !comments) {
      apiClient.getMyComments().then(res => { if (!cancelled) setComments(res); }).catch(console.error);
    }
    if (activeTab === "activities" && !activities) {
      apiClient.getMySurveyResponses().then(res => { if (!cancelled) setActivities(res); }).catch(console.error);
    }
    return () => { cancelled = true; };
  }, [activeTab, user, apiClient, articles, comments, activities]);

  const userName = (user?.user && "name" in user.user)
    ? (user.user as { name?: string }).name ?? "사용자"
    : "사용자";

  const TABS = [
    { id: "info", label: "내 정보" },
    { id: "posts", label: "내가 쓴 글" },
    { id: "comments", label: "내가 쓴 댓글" },
    { id: "activities", label: "참여 내역" },
  ] as const;

  return (
    <div className="min-h-screen bg-kaist-white flex flex-col">
      <Header showLogo />
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black text-kaist-black">마이페이지</h1>

        {!session?.authenticated ? (
          <div className="mt-8 rounded-2xl border border-kaist-grey/30 bg-white p-6 text-center">
            <p className="text-sm text-kaist-grey">로그인이 필요합니다.</p>
            <Link
              to="/login"
              className="mt-4 inline-flex items-center rounded-lg border border-kaist-darkgreen px-4 py-2 text-sm font-semibold text-kaist-darkgreen hover:bg-kaist-darkgreen/5 transition-colors"
            >
              로그인 페이지로 이동
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex flex-col md:flex-row gap-8">
            {/* Sidebar Tabs */}
            <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 shrink-0 md:w-48 no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-kaist-darkgreen text-white shadow-md"
                      : "text-kaist-grey hover:bg-kaist-darkgreen/5 hover:text-kaist-black"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {activeTab === "info" && (
                <div className="grid gap-4 rounded-2xl border border-kaist-grey/30 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-kaist-greygreen">
                      Profile
                    </p>
                    <p className="mt-1 text-2xl font-black text-kaist-black">{userName}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-kaist-grey mt-4">
                    <div className="flex items-center justify-between border-b border-kaist-grey/10 pb-2">
                      <span className="font-semibold text-kaist-black">사용자 ID</span>
                      <span>{user?.user?.id ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-kaist-grey/10 pb-2">
                      <span className="font-semibold text-kaist-black">권한 비트</span>
                      <span>{user?.user?.permission ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "posts" && (
                <div className="rounded-2xl border border-kaist-grey/30 bg-white p-6 shadow-sm">
                  {!articles ? (
                    <p className="text-center text-sm text-kaist-grey py-10">로딩 중...</p>
                  ) : articles.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                      <svg className="w-12 h-12 text-kaist-grey/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="text-base font-semibold text-kaist-black">작성한 글이 없습니다.</p>
                      <p className="text-sm text-kaist-grey mt-1">게시판에서 새로운 글을 작성해보세요.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-kaist-grey/10">
                      {articles.items.map((item) => (
                        <li key={item.articleId} className="py-4 first:pt-0 last:pb-0">
                          <Link to={`/board/${item.boardCode}/${item.articleId}`} className="block group">
                            <p className="text-xs font-semibold text-kaist-darkgreen mb-1">{item.boardNameKo}</p>
                            <h3 className="text-base font-bold text-kaist-black group-hover:text-kaist-darkgreen transition-colors">{item.titleKo}</h3>
                            <div className="flex items-center gap-4 mt-2 text-xs text-kaist-grey">
                              <span>{new Date(item.postedAt).toLocaleDateString()}</span>
                              <span>댓글 {item.commentCount}</span>
                              {item.status !== "PUBLISHED" && (
                                <span className="bg-kaist-grey/10 px-2 py-0.5 rounded text-kaist-greygreen font-medium">{item.status}</span>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "comments" && (
                <div className="rounded-2xl border border-kaist-grey/30 bg-white p-6 shadow-sm">
                  {!comments ? (
                    <p className="text-center text-sm text-kaist-grey py-10">로딩 중...</p>
                  ) : comments.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                      <svg className="w-12 h-12 text-kaist-grey/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <p className="text-base font-semibold text-kaist-black">작성한 댓글이 없습니다.</p>
                      <p className="text-sm text-kaist-grey mt-1">다른 사람의 글에 댓글을 남겨보세요.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-kaist-grey/10">
                      {comments.items.map((item) => (
                        <li key={item.commentId} className="py-4 first:pt-0 last:pb-0">
                          <Link to={`/board/${item.boardCode}/${item.articleId}`} className="block group">
                            <p className="text-xs text-kaist-grey mb-1">
                              <span className="font-semibold text-kaist-darkgreen">{item.boardNameKo}</span>
                              <span className="mx-1">&middot;</span>
                              {item.articleTitleKo}
                            </p>
                            <p className="text-sm text-kaist-black mt-1 group-hover:text-kaist-darkgreen transition-colors line-clamp-2">{item.content}</p>
                            <p className="text-xs text-kaist-grey mt-2">{new Date(item.createdAt).toLocaleDateString()}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "activities" && (
                <div className="rounded-2xl border border-kaist-grey/30 bg-white p-6 shadow-sm">
                  {!activities ? (
                    <p className="text-center text-sm text-kaist-grey py-10">로딩 중...</p>
                  ) : activities.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                      <svg className="w-12 h-12 text-kaist-grey/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <p className="text-base font-semibold text-kaist-black">참여 내역이 없습니다.</p>
                      <p className="text-sm text-kaist-grey mt-1">참여한 설문조사 및 신청한 행사가 여기에 표시됩니다.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-kaist-grey/10">
                      {activities.items.map((item) => (
                        <li key={item.responseId} className="py-4 first:pt-0 last:pb-0">
                          <Link to={`/survey/${item.surveyId}`} className="block group flex items-start justify-between">
                            <div>
                              <h3 className="text-base font-bold text-kaist-black group-hover:text-kaist-darkgreen transition-colors">{item.surveyTitleKo}</h3>
                              {item.submittedAt && (
                                <p className="text-xs text-kaist-grey mt-1">제출일: {new Date(item.submittedAt).toLocaleDateString()}</p>
                              )}
                            </div>
                            <div className="shrink-0 ml-4">
                              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                item.status === "approved" ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" :
                                item.status === "rejected" ? "bg-red-100 text-red-700" :
                                item.status === "submitted" ? "bg-blue-100 text-blue-700" :
                                "bg-kaist-grey/10 text-kaist-greygreen"
                              }`}>
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
