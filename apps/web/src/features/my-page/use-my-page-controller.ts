import type {
  CurrentUserResponse,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MySurveyResponseListResponse,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Clock3,
  FileText,
  MessageCircle,
  User,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import { hasAdminPermission } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

export type ActivityItem = {
  date: string;
  href: string;
  label: string;
  title: string;
  type: "survey" | "post" | "comment";
};

export type ActivityTab = "all" | "survey" | "post" | "comment";
export type MyPageMenu = "overview" | "profile" | "activity";

export type MyPageStat = {
  color: string;
  icon: LucideIcon;
  label: string;
  value: number;
};

const MY_PAGE_LIMIT = 20;
const ITEMS_PER_PAGE = 10;
const OVERVIEW_LIMIT = 10;

const compactText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

export function useMyPageController() {
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
  const [activeMenu, setActiveMenu] = useState<MyPageMenu>("overview");
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
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
    if (!user?.user) {
      return compactText(session?.nameKo) ?? compactText(session?.nameEn) ?? "";
    }
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

  const stats: MyPageStat[] = [
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

  const menuItems = [
    { id: "overview", label: "개요", icon: User },
    { id: "profile", label: "내 정보", icon: FileText },
    { id: "activity", label: "활동 내역", icon: Clock3 },
  ] as const;

  const handleLogout = async () => {
    await apiClient.logout(getTemporaryAuthRequest());
    clearStoredAuthState();
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    window.location.assign("/");
  };

  const showAllActivities = () => {
    setActiveMenu("activity");
    setActiveTab("all");
    setCurrentPage(1);
  };

  return {
    activeMenu,
    activeTab,
    allActivities,
    canUseMyPage,
    currentPage,
    displayName,
    filteredActivities,
    handleLogout,
    isAdmin,
    loadError,
    loading,
    menuItems,
    session,
    sessionLoading,
    setActiveMenu,
    setActiveTab,
    setCurrentPage,
    showAllActivities,
    stats,
    totalPages,
    userInfo,
  };
}
