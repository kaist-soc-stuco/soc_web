import type {
  CurrentUserResponse,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MySurveyResponseListResponse,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { isoToMs, nowMs } from "@soc/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Clock3,
  FileText,
  LogOut,
  MessageCircle,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/data-state";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import { hasAdminPermission } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

type ActivityItem = {
  date: string;
  href: string;
  label: string;
  title: string;
  type: "survey" | "post" | "comment";
};

type ActivityTab = "all" | "survey" | "post" | "comment";

const formatRelative = (value?: string | null) => {
  if (!value) return "-";
  const time = isoToMs(value);
  if (Number.isNaN(time)) return "-";

  const diffDays = Math.floor((nowMs() - time) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return "오늘";
  }
  if (diffDays === 1) {
    return "어제";
  }
  return `${diffDays}일 전`;
};

const MY_PAGE_LIMIT = 20;
const ITEMS_PER_PAGE = 10;
const OVERVIEW_LIMIT = 10;

export function MyPage() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [articles, setArticles] = useState<MyArticleListResponse | null>(null);
  const [comments, setComments] = useState<MyCommentListResponse | null>(null);
  const [surveyResponses, setSurveyResponses] =
    useState<MySurveyResponseListResponse | null>(null);
  const [activities, setActivities] = useState<MyActivityListResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeMenu, setActiveMenu] = useState<
    "overview" | "profile" | "activity"
  >("overview");
  const [activeTab, setActiveTab] = useState<
    "all" | "survey" | "post" | "comment"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);

  const canUseMyPage = hasPersistedProfile(session ?? null);

  useEffect(() => {
    if (!canUseMyPage) {
      setUser(null);
      setArticles(null);
      setComments(null);
      setSurveyResponses(null);
      setActivities(null);
      return;
    }

    let cancelled = false;
    const isActivityView = activeMenu === "activity";
    const activeListPage = isActivityView ? currentPage : 1;
    const activeListLimit = isActivityView ? ITEMS_PER_PAGE : OVERVIEW_LIMIT;
    const activityPage = activeTab === "all" ? activeListPage : 1;
    const articlePage = activeTab === "post" ? activeListPage : 1;
    const commentPage = activeTab === "comment" ? activeListPage : 1;
    const surveyPage = activeTab === "survey" ? activeListPage : 1;

    setLoading(true);
    setLoadError(null);

    Promise.all([
      apiClient.getCurrentUser(),
      apiClient.getMyActivities({
        limit: activeTab === "all" ? activeListLimit : OVERVIEW_LIMIT,
        page: activityPage,
      }),
      apiClient.getMyArticles({
        limit: activeTab === "post" ? activeListLimit : MY_PAGE_LIMIT,
        page: articlePage,
      }),
      apiClient.getMyComments({
        limit: activeTab === "comment" ? activeListLimit : MY_PAGE_LIMIT,
        page: commentPage,
      }),
      apiClient.getMySurveyResponses({
        limit: activeTab === "survey" ? activeListLimit : MY_PAGE_LIMIT,
        page: surveyPage,
      }),
    ])
      .then(
        ([
          fetchedUser,
          fetchedActivities,
          fetchedArticles,
          fetchedComments,
          fetchedSurveyResponses,
        ]) => {
          if (cancelled) return;
          setUser(fetchedUser);
          setActivities(fetchedActivities);
          setArticles(fetchedArticles);
          setComments(fetchedComments);
          setSurveyResponses(fetchedSurveyResponses);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setActivities({ items: [], limit: OVERVIEW_LIMIT, page: 1, total: 0 });
        setArticles({ items: [], limit: MY_PAGE_LIMIT, page: 1, total: 0 });
        setComments({ items: [], limit: MY_PAGE_LIMIT, page: 1, total: 0 });
        setSurveyResponses({
          items: [],
          limit: MY_PAGE_LIMIT,
          page: 1,
          total: 0,
        });
        setLoadError(
          "마이페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMenu, activeTab, apiClient, canUseMyPage, currentPage]);

  const displayName = useMemo(() => {
    if (!user?.user)
      return compactText(session?.nameKo) ?? compactText(session?.nameEn) ?? "";
    return lang === "ko"
      ? user.user.nameKo
      : user.user.nameEn || user.user.nameKo;
  }, [lang, session, user]);

  const userInfo = user?.user;
  const isAdmin = hasAdminPermission(userInfo?.permission);

  const articleItems = articles?.items ?? [];
  const commentItems = comments?.items ?? [];
  const surveyItems = surveyResponses?.items ?? [];

  const allActivities = useMemo<ActivityItem[]>(() => {
    const labelMap = {
      comment: lang === "ko" ? "댓글" : "Comment",
      post: lang === "ko" ? "글" : "Post",
      survey: lang === "ko" ? "설문" : "Survey",
    };

    return (activities?.items ?? []).map((item) => ({
      date: item.occurredAt,
      href:
        item.type === "survey"
          ? `/survey/${item.surveyId}`
          : `/board/${item.boardCode}/${item.articleId}`,
      label: labelMap[item.type],
      title: item.title,
      type: item.type,
    }));
  }, [activities, lang]);

  const surveyActivities = useMemo<ActivityItem[]>(
    () =>
      surveyItems.map((item) => ({
        date: item.submittedAt ?? "",
        href: `/survey/${item.surveyId}`,
        label: lang === "ko" ? "설문" : "Survey",
        title: item.surveyTitleKo,
        type: "survey" as const,
      })),
    [surveyItems, lang],
  );

  const postActivities = useMemo<ActivityItem[]>(
    () =>
      articleItems.map((item) => ({
        date: item.postedAt,
        href: `/board/${item.boardCode}/${item.articleId}`,
        label: lang === "ko" ? "글" : "Post",
        title: item.titleKo,
        type: "post" as const,
      })),
    [articleItems, lang],
  );

  const commentActivities = useMemo<ActivityItem[]>(
    () =>
      commentItems.map((item) => ({
        date: item.createdAt,
        href: `/board/${item.boardCode}/${item.articleId}`,
        label: lang === "ko" ? "댓글" : "Comment",
        title: item.content,
        type: "comment" as const,
      })),
    [commentItems, lang],
  );

  const filteredActivities = useMemo(() => {
    if (activeTab === "all") return allActivities;
    if (activeTab === "survey") return surveyActivities;
    if (activeTab === "post") return postActivities;
    return commentActivities;
  }, [
    activeTab,
    allActivities,
    commentActivities,
    postActivities,
    surveyActivities,
  ]);

  const paginatedActivities = filteredActivities;

  const activityTotal = activities?.total ?? allActivities.length;
  const articleTotal = articles?.total ?? articleItems.length;
  const commentTotal = comments?.total ?? commentItems.length;
  const surveyTotal = surveyResponses?.total ?? surveyItems.length;
  const selectedTotal =
    activeTab === "all"
      ? activityTotal
      : activeTab === "survey"
        ? surveyTotal
        : activeTab === "post"
          ? articleTotal
          : commentTotal;

  const totalPages = Math.max(1, Math.ceil(selectedTotal / ITEMS_PER_PAGE));

  const stats = [
    {
      label: "설문 참여",
      value: surveyTotal,
      icon: ClipboardCheck,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
    },
    {
      label: "최근 활동",
      value: activityTotal,
      icon: Clock3,
      color: "text-blue-600 bg-blue-50 border-blue-100/50",
    },
    {
      label: "작성한 글",
      value: articleTotal,
      icon: FileText,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100/50",
    },
    {
      label: "작성한 댓글",
      value: commentTotal,
      icon: MessageCircle,
      color: "text-slate-600 bg-slate-50 border-slate-200/50",
    },
  ];

  const handleLogout = async () => {
    await apiClient.logout(getTemporaryAuthRequest());
    clearStoredAuthState();
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    window.location.assign("/");
  };

  const menuItems = [
    { id: "overview", label: "개요", icon: User },
    { id: "profile", label: "내 정보", icon: FileText },
    { id: "activity", label: "활동 내역", icon: Clock3 },
  ] as const;

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-950 flex flex-col">
      <Header showLogo />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-8 flex gap-8 items-start">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border border-slate-200 bg-white rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.015)] md:block sticky top-6">
          <div className="flex items-center gap-2 px-2 pb-3 border-b border-slate-100 select-none">
            <User className="h-4.5 w-4.5 text-kaist-darkgreen" />
            <span className="text-[15px] font-bold text-slate-900">
              마이페이지
            </span>
          </div>

          <nav className="mt-4 flex flex-col gap-1 select-none">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveMenu(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold border-0 transition-colors cursor-pointer text-left ${
                    isActive
                      ? "bg-emerald-50/70 text-kaist-darkgreen shadow-sm shadow-emerald-500/5"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-slate-100 pt-3 select-none">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-0 bg-transparent cursor-pointer text-left"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>로그아웃</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {sessionLoading || loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs font-bold text-slate-400 shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-kaist-darkgreen/30 border-t-kaist-darkgreen rounded-full animate-spin"></div>
              <span>마이페이지 정보를 불러오는 중입니다...</span>
            </div>
          ) : !canUseMyPage ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-xl mx-auto">
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                {session?.authenticated
                  ? "마이페이지는 개인정보 저장 동의가 완료된 계정에서 이용할 수 있습니다."
                  : "로그인이 필요합니다."}
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex items-center rounded-lg border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen hover:bg-kaist-darkgreen/5 select-none"
              >
                로그인 페이지로 이동
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5 w-full">
              {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs font-bold text-amber-800">
                  {loadError}
                </div>
              )}

              {/* View Panel switcher governed by activeMenu state */}
              {activeMenu === "overview" && (
                <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                  <div className="mb-1 select-none">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                      개요
                    </h1>
                  </div>

                  {/* 1. Profile Summary */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                        {displayName}
                      </h2>

                      {/* Admin status tag */}
                      {isAdmin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e6f4ea] text-kaist-darkgreen border border-emerald-100 select-none">
                          관리자
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-slate-400 font-semibold select-none">
                          소속
                        </span>
                        <span className="text-[13px] font-semibold text-slate-800">
                          {userInfo?.departmentKo ?? "-"}
                          {userInfo?.academicStatus &&
                            ` · ${userInfo.academicStatus}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-slate-400 font-semibold select-none">
                          학번
                        </span>
                        <span className="text-[13px] font-semibold text-slate-800">
                          {userInfo?.studentNumber ?? "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-slate-400 font-semibold select-none">
                          이메일
                        </span>
                        <span className="text-[13px] font-semibold text-slate-800">
                          {userInfo?.email ?? "-"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* 2. Stats Grid [설문 참여] [최근 활동] [작성한 글] [작성한 댓글] */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {stats.map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_15px_rgba(0,0,0,0.015)] flex items-center gap-3 transition-all hover:translate-y-[-1px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.02)]"
                        >
                          <div
                            className={`p-2 rounded-lg border shrink-0 ${stat.color}`}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-400">
                              {stat.label}
                            </span>
                            <span className="text-xl font-bold text-slate-900 mt-0.5 leading-none">
                              {stat.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3. Recent Activities (Unified chronological list of most recent 10 items) */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col">
                    <div className="flex flex-col border-b border-slate-100 pb-3.5 mb-4 select-none gap-1">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900">
                          최근 활동
                        </h2>
                        <button
                          onClick={() => {
                            setActiveMenu("activity");
                            setActiveTab("all");
                            setCurrentPage(1);
                          }}
                          className="text-[13px] font-bold text-kaist-darkgreen hover:opacity-85 border-0 bg-transparent cursor-pointer flex items-center gap-0.5 transition-opacity"
                        >
                          <span>전체 보기</span>
                          <svg
                            className="w-3 h-3 text-kaist-darkgreen"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs font-medium text-slate-400">
                        최근 30일 동안 제출된 설문, 작성된 게시글 및 댓글의 전체
                        기록을 확인합니다.
                      </p>
                    </div>

                    {allActivities.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none">
                        <div className="p-3 rounded-full bg-slate-50 border border-slate-100 text-slate-400 mb-3">
                          <Clock3 className="h-6 w-6 stroke-[1.75]" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">
                          최근 활동 내역이 없습니다
                        </h3>
                        <p className="text-xs font-medium text-slate-400 mt-1 max-w-xs leading-normal">
                          설문 참여, 커뮤니티 게시글 및 댓글 작성을 통해 KAIST
                          TREE 활동을 시작해 보세요.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {allActivities.slice(0, 10).map((item, index) => {
                          const isSurvey = item.type === "survey";
                          const badgeBg = isSurvey
                            ? "bg-[#e6f4ea] text-[#137333] border-[#e6f4ea]/50"
                            : "bg-slate-50 text-slate-600 border-slate-200/50";

                          return (
                            <Link
                              key={`${item.type}-${item.href}-${index}`}
                              to={item.href}
                              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 py-3.5 transition-colors group hover:bg-slate-50/50 px-3 -mx-3 rounded-lg"
                            >
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 select-none ${badgeBg}`}
                              >
                                {item.label}
                              </span>
                              <span className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-kaist-darkgreen transition-colors min-w-0 pr-2">
                                {item.title}
                              </span>
                              <span className="whitespace-nowrap text-xs font-medium text-slate-400 mr-1.5">
                                {formatRelative(item.date)}
                              </span>
                              <svg
                                className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeMenu === "profile" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  <div className="mb-1.5 select-none">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                      내 정보
                    </h1>
                    <p className="text-xs font-medium text-slate-400 mt-1">
                      KAIST 포털 계정과 연동된 기본 정보입니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] divide-y divide-slate-100 select-none">
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">이름</span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {displayName}
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">학번</span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {userInfo?.studentNumber ?? "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">
                        이메일
                      </span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {userInfo?.email ?? "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">소속</span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {userInfo?.departmentKo ?? "-"}
                        {userInfo?.academicStatus &&
                          ` (${userInfo.academicStatus})`}
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">상태</span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {userInfo?.academicStatus ?? "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center">
                      <span className="font-semibold text-slate-400">권한</span>
                      <span className="font-bold text-slate-800 text-[14px]">
                        {isAdmin ? "관리자" : "일반 사용자"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeMenu === "activity" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  <div className="mb-1.5 select-none">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                      활동 내역
                    </h1>
                    <p className="text-xs font-medium text-slate-400 mt-1">
                      게시글, 댓글, 설문 참여 기록을 확인할 수 있습니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col">
                    {/* Underlined filter navigation tabs */}
                    <div className="flex gap-6 border-b border-slate-100 pb-2 mb-4 overflow-x-auto items-stretch select-none">
                      {([
                        { id: "all", label: "전체" },
                        { id: "survey", label: "설문" },
                        { id: "post", label: "작성한 글" },
                        { id: "comment", label: "작성한 댓글" },
                      ] as const satisfies ReadonlyArray<{ id: ActivityTab; label: string }>).map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id);
                              setCurrentPage(1);
                            }}
                            className={`relative flex items-center justify-center text-[13px] font-semibold pb-2 border-0 bg-transparent cursor-pointer transition-colors ${
                              isActive
                                ? "text-kaist-darkgreen"
                                : "text-slate-400 hover:text-kaist-darkgreen"
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`absolute bottom-0 left-0 right-0 h-[2px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                                isActive ? "scale-x-100" : "scale-x-0"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Paginated rows */}
                    {paginatedActivities.length === 0 ? (
                      <EmptyState
                        message="내역이 없습니다."
                        minHeightClassName="min-h-[200px]"
                      />
                    ) : (
                      <div className="divide-y divide-slate-100 flex-1">
                        {paginatedActivities.map((item, index) => {
                          const isSurvey = item.type === "survey";
                          const badgeBg = isSurvey
                            ? "bg-[#e6f4ea] text-[#137333] border-[#e6f4ea]/50"
                            : "bg-slate-50 text-slate-600 border-slate-200/50";

                          return (
                            <Link
                              key={`${item.type}-${item.href}-${index}`}
                              to={item.href}
                              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 py-3.5 transition-colors group hover:bg-slate-50/50 px-3 -mx-3 rounded-lg"
                            >
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 select-none ${badgeBg}`}
                              >
                                {item.label}
                              </span>
                              <span className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-kaist-darkgreen transition-colors min-w-0 pr-2">
                                {item.title}
                              </span>
                              <span className="whitespace-nowrap text-xs font-medium text-slate-400 mr-1.5">
                                {formatRelative(item.date)}
                              </span>
                              <svg
                                className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="border-t border-slate-100 pt-4 mt-4 flex justify-center select-none">
                        <Pagination
                          currentPage={currentPage}
                          onPageChange={setCurrentPage}
                          size="sm"
                          totalPages={totalPages}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

const compactText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};
