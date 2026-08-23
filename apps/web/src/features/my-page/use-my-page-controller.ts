import type {
  CurrentUserResponse,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MyScrapListResponse,
  MySurveyResponseListResponse,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { Clock3, FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  date: string;
  href: string;
  label: string;
  title: string;
  type: "survey" | "post" | "comment";
};

export type ActivityTab =
  | "all"
  | "survey"
  | "post"
  | "comment"
  | "scraps";
export type MyPageMenu = "profile" | "activity";

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
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [articles, setArticles] = useState<MyArticleListResponse | null>(null);
  const [comments, setComments] = useState<MyCommentListResponse | null>(null);
  const [scraps, setScraps] = useState<MyScrapListResponse | null>(null);
  const [surveyResponses, setSurveyResponses] =
    useState<MySurveyResponseListResponse | null>(null);
  const [activities, setActivities] = useState<MyActivityListResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<MyPageMenu>("profile");
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const [displayedActivityTab, setDisplayedActivityTab] =
    useState<ActivityTab>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [activityQuery, setActivityQuery] = useState("");
  const hasLoadedDataRef = useRef(false);

  const canUseMyPage = hasPersistedProfile(session ?? null);

  useEffect(() => {
    if (!canUseMyPage) {
      setUser(null);
      setArticles(null);
      setComments(null);
      setScraps(null);
      setSurveyResponses(null);
      setActivities(null);
      setDisplayedActivityTab("all");
      hasLoadedDataRef.current = false;
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    const isActivityView = activeMenu === "activity";
    const isListView = isActivityView;
    const activeListPage = isListView ? currentPage : 1;
    const activeListLimit = isListView ? ITEMS_PER_PAGE : OVERVIEW_LIMIT;
    const activityPage = activeTab === "all" ? activeListPage : 1;
    const articlePage = activeTab === "post" ? activeListPage : 1;
    const commentPage = activeTab === "comment" ? activeListPage : 1;
    const surveyPage = activeTab === "survey" ? activeListPage : 1;
    const scrapPage = activeTab === "scraps" ? activeListPage : 1;

    setLoading(true);
    setLoadError(null);

    Promise.all([
      apiClient.getCurrentUser(),
      apiClient.getMyActivities({
        limit: activeTab === "all" ? activeListLimit : OVERVIEW_LIMIT,
        page: activityPage,
        q: activityQuery,
      }),
      apiClient.getMyArticles({
        limit: activeTab === "post" ? activeListLimit : MY_PAGE_LIMIT,
        page: articlePage,
        q: activityQuery,
      }),
      apiClient.getMyComments({
        limit: activeTab === "comment" ? activeListLimit : MY_PAGE_LIMIT,
        page: commentPage,
        q: activityQuery,
      }),
      apiClient.getMySurveyResponses({
        limit: activeTab === "survey" ? activeListLimit : MY_PAGE_LIMIT,
        page: surveyPage,
        q: activityQuery,
      }),
      apiClient.getMyScraps({ limit: ITEMS_PER_PAGE, page: scrapPage }),
    ])
      .then(
        ([
          fetchedUser,
          fetchedActivities,
          fetchedArticles,
          fetchedComments,
          fetchedSurveyResponses,
          fetchedScraps,
        ]) => {
          if (cancelled) return;
          setUser(fetchedUser);
          setActivities(fetchedActivities);
          setArticles(fetchedArticles);
          setComments(fetchedComments);
          setSurveyResponses(fetchedSurveyResponses);
          setScraps(fetchedScraps);
          setDisplayedActivityTab(activeTab);
          hasLoadedDataRef.current = true;
        },
      )
      .catch(() => {
        if (cancelled) return;
        if (!hasLoadedDataRef.current) {
          setUser(null);
          setActivities({ items: [], limit: OVERVIEW_LIMIT, page: 1, total: 0 });
          setArticles({ items: [], limit: MY_PAGE_LIMIT, page: 1, total: 0 });
          setComments({ items: [], limit: MY_PAGE_LIMIT, page: 1, total: 0 });
          setScraps({ items: [], limit: ITEMS_PER_PAGE, page: 1, total: 0 });
          setSurveyResponses({
            items: [],
            limit: MY_PAGE_LIMIT,
            page: 1,
            total: 0,
          });
          hasLoadedDataRef.current = true;
        }
        setLoadError(
          lang === "ko"
            ? "마이페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "Failed to load your account information. Please try again shortly.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeMenu,
    activeTab,
    activityQuery,
    apiClient,
    canUseMyPage,
    currentPage,
    lang,
  ]);

  const displayName = useMemo(() => {
    if (!user?.user) {
      return compactText(session?.nameKo) ?? compactText(session?.nameEn) ?? "";
    }
    return lang === "ko"
      ? user.user.nameKo
      : user.user.nameEn || user.user.nameKo;
  }, [lang, session, user]);

  const userInfo = user?.user;
  const hasLoadedMyPageData =
    user !== null ||
    articles !== null ||
    comments !== null ||
    scraps !== null ||
    surveyResponses !== null ||
    activities !== null ||
    loadError !== null;
  const initialLoading =
    sessionLoading || (canUseMyPage && loading && !hasLoadedMyPageData);
  const isAdmin = hasAdminPermission(userInfo?.permission);
  const articleItems = articles?.items ?? [];
  const commentItems = comments?.items ?? [];
  const scrapItems = scraps?.items ?? [];
  const surveyItems = surveyResponses?.items ?? [];

  const allActivities = useMemo<ActivityItem[]>(() => {
    const labelMap = {
      comment: lang === "ko" ? "댓글" : "Comment",
      post: lang === "ko" ? "글" : "Post",
      survey: lang === "ko" ? "설문" : "Survey",
    };

    return (activities?.items ?? []).map((item) => {
      const display = getMyActivityDisplay(lang, item);

      return {
        context: display.context
          ? `${lang === "ko" ? "게시글" : "Post"}: ${display.context}`
          : undefined,
        date: item.occurredAt,
        href:
          item.type === "survey"
            ? `/survey/${item.surveyId}`
            : `/board/${item.boardCode}/${item.articleId}`,
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
        label: lang === "ko" ? "설문" : "Survey",
        title: getMySurveyTitle(lang, item),
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
            ? `${lang === "ko" ? "게시글" : "Post"}: ${display.context}`
            : undefined,
          date: item.createdAt,
          href: `/board/${item.boardCode}/${item.articleId}`,
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
