import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { Clock3, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { hasAdminPermission } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import {
  getMyActivityDisplay,
  getMyArticleTitle,
  getMyCommentDisplay,
  getMySurveyTitle,
} from "@/lib/my-page-localization";

export type ActivityItem = {
  context?: string;
  boardName?: string;
  commentCount?: number;
  date: string;
  href: string;
  label: string;
  title: string;
  type: "survey" | "post" | "comment" | "scrap";
};

export type ActivityTab =
  | "all"
  | "survey"
  | "post"
  | "comment"
  | "scraps";
export type MyPageMenu = "profile" | "activity";

const ITEMS_PER_PAGE = 10;

const compactText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

export function useMyPageController() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  const [params, setParams] = useSearchParams();
  const activeMenu: MyPageMenu = params.get("menu") === "activity" ? "activity" : "profile";
  const tabParam = params.get("tab");
  const activeTab: ActivityTab = (["all", "survey", "post", "comment", "scraps"] as const).find(tab => tab === tabParam) ?? "all";
  const displayedActivityTab = activeTab;
  const pageParam = Number(params.get("page"));
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const activityQuery = params.get("q") ?? "";
  const [debouncedQuery, setDebouncedQuery] = useState(activityQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(activityQuery), 250);
    return () => window.clearTimeout(timer);
  }, [activityQuery]);
  const updateParams = (changes: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    setParams(next, { replace, state: { preserveScroll: replace } });
  };
  const setActiveMenu = (menu: MyPageMenu) => updateParams({ menu, page: "" });
  const setActiveTab = (tab: ActivityTab) => updateParams({ tab, page: "" });
  const setCurrentPage = (page: number) => updateParams({ page: page === 1 ? "" : String(page) });
  const setActivityQuery = (q: string) => updateParams({ q, page: "" }, true);
  const canUseMyPage = hasPersistedProfile(session ?? null);
  const identity = session?.userId;
  const profile = useQuery({ queryKey: ["my-page", identity, "profile"], queryFn: () => apiClient.getCurrentUser(), enabled: canUseMyPage });
  const options = { limit: ITEMS_PER_PAGE, page: currentPage, q: debouncedQuery };
  const enabled = (tab: ActivityTab) => canUseMyPage && activeMenu === "activity" && activeTab === tab && activityQuery === debouncedQuery;
  const key = (tab: ActivityTab) => ["my-page", identity, tab, currentPage, debouncedQuery];
  const activityResult = useQuery({ queryKey: key("all"), queryFn: () => apiClient.getMyActivities(options), enabled: enabled("all") });
  const articleResult = useQuery({ queryKey: key("post"), queryFn: () => apiClient.getMyArticles(options), enabled: enabled("post") });
  const commentResult = useQuery({ queryKey: key("comment"), queryFn: () => apiClient.getMyComments(options), enabled: enabled("comment") });
  const surveyResult = useQuery({ queryKey: key("survey"), queryFn: () => apiClient.getMySurveyResponses(options), enabled: enabled("survey") });
  const scrapResult = useQuery({ queryKey: key("scraps"), queryFn: () => apiClient.getMyScraps(options), enabled: enabled("scraps") });
  const selected = { all: activityResult, post: articleResult, comment: commentResult, survey: surveyResult, scraps: scrapResult }[activeTab];
  const user = profile.data;
  const articles = articleResult.data;
  const comments = commentResult.data;
  const scraps = scrapResult.data;
  const surveyResponses = surveyResult.data;
  const activities = activityResult.data;
  const loading = activityQuery !== debouncedQuery || selected.isPending;
  const profileError = profile.isError;
  const loadError = selected.isError ? (lang === "ko" ? "활동 내역을 불러오지 못했습니다." : "Could not load your activity.") : null;
  const retryActivity = () => void selected.refetch();
  const retryProfile = () => void profile.refetch();

  const displayName = useMemo(() => {
    if (!user?.user) {
      return compactText(session?.nameKo) ?? compactText(session?.nameEn) ?? "";
    }
    return lang === "ko"
      ? user.user.nameKo
      : user.user.nameEn || user.user.nameKo;
  }, [lang, session, user]);

  const userInfo = user?.user;
  const initialLoading = sessionLoading || (canUseMyPage && activeMenu === "profile" && profile.isPending);
  const isAdmin = hasAdminPermission(userInfo?.permission);
  const articleItems = articles?.items ?? [];
  const commentItems = comments?.items ?? [];
  const scrapItems = scraps?.items ?? [];
  const surveyItems = surveyResponses?.items ?? [];

  const allActivities = useMemo<ActivityItem[]>(() => {
    const labelMap = {
      scrap: lang === "ko" ? "스크랩" : "Saved",
      comment: lang === "ko" ? "댓글" : "Comment",
      post: lang === "ko" ? "작성" : "Posted",
      survey: lang === "ko" ? "응답 완료" : "Responded",
    };

    return (activities?.items ?? []).map((item) => {
      const display = getMyActivityDisplay(lang, item);

      return {
        context: display.context
          ? display.context
          : undefined,
        boardName: (lang === "ko" ? item.boardNameKo : item.boardNameEn || item.boardNameKo) || undefined,
        date: item.occurredAt,
        href:
          item.type === "survey"
            ? `/survey/${item.surveyId}`
            : item.boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${item.boardCode}/${item.articleId}`,
        label: labelMap[item.type],
        title: display.title,
        type: item.type,
      };
    });
  }, [activities, lang]);

  const surveyActivities = useMemo<ActivityItem[]>(
    () =>
      surveyItems.map((item) => ({
        date: item.submittedAt ?? "",
        href: `/survey/${item.surveyId}`,
        label: lang === "ko" ? "응답 완료" : "Responded",
        title: getMySurveyTitle(lang, item),
        type: "survey" as const,
      })),
    [surveyItems, lang],
  );

  const postActivities = useMemo<ActivityItem[]>(
    () =>
      articleItems.map((item) => ({
        boardName: lang === "ko" ? item.boardNameKo : item.boardNameEn || item.boardNameKo,
        commentCount: item.commentCount,
        date: item.postedAt,
        href: item.boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${item.boardCode}/${item.articleId}`,
        label: lang === "ko" ? "작성" : "Posted",
        title: getMyArticleTitle(lang, item),
        type: "post" as const,
      })),
    [articleItems, lang],
  );

  const commentActivities = useMemo<ActivityItem[]>(
    () =>
      commentItems.map((item) => {
        const display = getMyCommentDisplay(lang, item);

        return {
          context: display.context
            ? display.context
            : undefined,
          boardName: lang === "ko" ? item.boardNameKo : item.boardNameEn || item.boardNameKo,
          date: item.createdAt,
          href: item.boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${item.boardCode}/${item.articleId}`,
          label: lang === "ko" ? "댓글" : "Comment",
          title: display.title,
          type: "comment" as const,
        };
      }),
    [commentItems, lang],
  );

  const filteredActivities = useMemo(() => {
    if (displayedActivityTab === "all") return allActivities;
    if (displayedActivityTab === "survey") return surveyActivities;
    if (displayedActivityTab === "post") return postActivities;
    return commentActivities;
  }, [
    allActivities,
    commentActivities,
    displayedActivityTab,
    postActivities,
    surveyActivities,
  ]);

  const activityTotal = activities?.total ?? allActivities.length;
  const articleTotal = articles?.total ?? articleItems.length;
  const commentTotal = comments?.total ?? commentItems.length;
  const surveyTotal = surveyResponses?.total ?? surveyItems.length;
  const selectedTotal =
    displayedActivityTab === "scraps"
      ? scraps?.total ?? scrapItems.length
      : displayedActivityTab === "all"
        ? activityTotal
        : displayedActivityTab === "survey"
          ? surveyTotal
          : displayedActivityTab === "post"
            ? articleTotal
            : commentTotal;
  const totalPages = Math.max(1, Math.ceil(selectedTotal / ITEMS_PER_PAGE));

  const menuItems = [
    { id: "profile", label: lang === "ko" ? "내 정보" : "Profile", icon: FileText },
    { id: "activity", label: lang === "ko" ? "활동 내역" : "Activity", icon: Clock3 },
  ] as const;

  return {
    activeMenu,
    activeTab,
    activityQuery,
    canUseMyPage,
    currentPage,
    displayName,
    displayedActivityTab,
    filteredActivities,
    initialLoading,
    isAdmin,
    lang,
    loadError,
    profileError,
    retryActivity,
    retryProfile,
    loading,
    menuItems,
    session,
    sessionLoading,
    scraps: scrapItems,
    setActivityQuery,
    setActiveMenu,
    setActiveTab,
    setCurrentPage,
    totalPages,
    userInfo,
  };
}
