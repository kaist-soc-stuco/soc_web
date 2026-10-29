import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { EventsSurveysCalendar } from "@/features/events-surveys/events-surveys-calendar";
import { CalendarSubscriptionButton } from "@/features/events-surveys/calendar-subscription-button";
import { EventsSurveysFilterBar } from "@/features/events-surveys/events-surveys-filter-bar";
import { EventsSurveysGrid } from "@/features/events-surveys/events-surveys-grid";
import { useEventsSurveysPageController } from "@/features/events-surveys/use-events-surveys-page-controller";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/data-state";
import { EventsSurveysLoadMore } from "@/features/events-surveys/events-surveys-load-more";
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";
import "@/features/events-surveys/events-surveys-calendar.css";
import { WriteFloatingAction } from "@/components/ui/write-floating-action";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  PageHeader,
  PageContainer,
  PageMain,
  PageShell,
} from "@/components/ui/page-layout";

export type EventsSurveysView = "event" | "survey" | "calendar";

function getEmptyStateMessage(
  view: EventsSurveysView,
  stateFilter: string,
  lang: string,
) {
  if (lang !== "ko") {
    const subject = view === "survey" ? "surveys" : "events";
    const status =
      stateFilter === "active"
        ? "upcoming or ongoing"
        : stateFilter === "before_open"
        ? "upcoming"
        : stateFilter === "open"
          ? "ongoing"
          : stateFilter === "closed"
            ? "closed"
            : "published";
    return `No ${status} ${subject} available.`;
  }

  if (view === "survey") {
    if (stateFilter === "active") return "예정되거나 진행 중인 설문이 없습니다.";
    if (stateFilter === "before_open") return "시작 예정인 설문이 없습니다.";
    if (stateFilter === "open") return "진행 중인 설문이 없습니다.";
    if (stateFilter === "closed") return "종료된 설문이 없습니다.";
    return "등록된 설문이 없습니다.";
  }

  if (stateFilter === "active") return "예정되거나 진행 중인 행사가 없습니다.";
  if (stateFilter === "before_open") return "시작 예정인 행사가 없습니다.";
  if (stateFilter === "open") return "진행 중인 행사가 없습니다.";
  if (stateFilter === "closed") return "지난 행사가 없습니다.";
  return "등록된 행사가 없습니다.";
}

export function EventsSurveysPage({ view }: { view?: EventsSurveysView }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [searchParams] = useSearchParams();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const currentTab = view ?? (searchParams.get("tab") as EventsSurveysView | null) ?? "event";
  const selectedParam = searchParams.get("selected");
  const {
    calendarFeedUrl,
    calendarEvents,
    isCalendarFetching,
    calendarQuery,
    hasMore,
    loadingMore,
    loadMoreError,
    isListUpdating,
    loadMore,
    currentDate,
    dateFrom,
    dateTo,
    engagementSubmitting,
    error,
    holidays,
    handleSetEngagement,
    loading,
    retry,
    selectedDate,
    setCurrentDate,
    setCalendarQuery,
    setDateRange,
    setListFilters,
    resetListFilters,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    totalItems,
    visibleItems,
  } = useEventsSurveysPageController({
    currentTab,
    lang,
    selectedParam,
  });

  const hasActiveListFilters =
    currentTab !== "calendar" &&
    Boolean(itemQuery.trim() || dateFrom || dateTo);
  const emptyStateMessage = hasActiveListFilters
    ? lang === "ko"
      ? currentTab === "survey"
        ? "조건에 맞는 설문이 없습니다."
        : "조건에 맞는 행사가 없습니다."
      : currentTab === "survey"
        ? "No surveys match these filters."
        : "No events match these filters."
    : getEmptyStateMessage(currentTab, stateFilter, lang);


  return (
    <PageShell className={`mobile-white-page${currentTab === "calendar" ? " calendar-page" : " discovery-page"}`}>


      <PageMain className={currentTab === "calendar" ? "calendar-page-main" : undefined}>
        <PageHeader
          className={currentTab === "calendar" ? "calendar-page-heading" : undefined}
          containerClassName={currentTab === "calendar" ? "mobile-calendar-page-heading events-list-page-heading max-w-[100rem] pt-4 sm:items-center" : "events-list-page-heading"}
          actions={
            currentTab === "calendar" ? (
              <CalendarSubscriptionButton feedUrl={calendarFeedUrl} lang={lang} />
            ) : currentTab === "survey" &&
            Permissions.has(session?.permission ?? 0, Permissions.MANAGE_SURVEY) ? (
              <Button asChild className="hidden md:inline-flex">
                <Link to="/admin/surveys/new">{lang === "ko" ? "등록" : "Create"}</Link>
              </Button>
            ) : currentTab === "event" &&
              Permissions.has(session?.permission ?? 0, Permissions.WRITE_OFFICIAL) ? (
              <Button asChild className="hidden md:inline-flex">
                <Link to="/events/write">
                  {lang === "ko" ? "등록" : "Create"}
                </Link>
              </Button>
            ) : undefined
          }
          title={
            currentTab === "calendar"
              ? lang === "ko" ? "일정" : "Calendar"
              : currentTab === "survey"
                ? lang === "ko" ? "설문" : "Surveys"
                : lang === "ko" ? "행사" : "Events"
          }
        />

        <PageContainer className={currentTab === "calendar" ? "calendar-page-body max-w-[100rem] pb-4" : "pb-8"}>
          {currentTab !== "calendar" && !loading ? (
            <EventsSurveysFilterBar
              isSurvey={currentTab === "survey"}
              lang={lang}
              onQueryChange={setItemQuery}
              onDateRangeChange={setDateRange}
              onStateFilterChange={setStateFilter}
              onFiltersChange={setListFilters}
              dateFrom={dateFrom}
              dateTo={dateTo}
              query={itemQuery}
              stateCounts={stateCounts}
              stateFilter={stateFilter}
            />
          ) : null}

          {loading ? (
            <div className="min-h-48" aria-busy="true" aria-label={lang === "ko" ? "목록 로딩" : "Loading list"} />
          ) : error ? (
            <ErrorState
              description={
                lang === "ko"
                  ? "일시적인 네트워크 오류일 수 있습니다.\n잠시 후 다시 시도해 주세요."
                  : "This may be a temporary network issue. Please try again."
              }
              onRetry={retry}
              retryLabel={lang === "ko" ? "다시 시도" : "Try again"}
              title={error}
            />
          ) : currentTab === "calendar" ? (
            <EventsSurveysCalendar
              calendarEvents={calendarEvents}
              isFetching={isCalendarFetching}
              calendarQuery={calendarQuery}
              currentDate={currentDate}
              holidays={holidays}
              lang={lang}
              onCalendarQueryChange={setCalendarQuery}
              onCurrentDateChange={setCurrentDate}
              onSelectedDateChange={setSelectedDate}
              selectedDate={selectedDate}
            />
          ) : totalItems === 0 ? (
            <EmptyState
              className="min-h-48 rounded-none border-0 bg-transparent"
              message={emptyStateMessage}
              minHeightClassName="min-h-48"
            >
              <span className="flex flex-col items-center gap-2">
                <span>{emptyStateMessage}</span>
                {hasActiveListFilters ? (
                  <button
                    className="text-xs font-normal text-slate-500 underline-offset-4 transition-colors hover:text-brand-primary hover:underline"
                    onClick={resetListFilters}
                    type="button"
                  >
                    {lang === "ko" ? "필터 초기화" : "Reset filters"}
                  </button>
                ) : null}
              </span>
            </EmptyState>
          ) : (
            <>
              <div className="discovery-list" aria-busy={isListUpdating} inert={isListUpdating || undefined}>
                <EventsSurveysGrid
                  hideDate={currentTab === "survey" && stateFilter === "always"}
                  engagementSubmitting={engagementSubmitting}
                  isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
                  items={visibleItems}
                  lang={lang}
                  onEngagementToggle={handleSetEngagement}
                />
              </div>
              <EventsSurveysLoadMore hasMore={hasMore} loading={loadingMore} failed={loadMoreError} onLoadMore={loadMore} lang={lang} />
            </>
          )}
        </PageContainer>
      </PageMain>
      {isMobile && currentTab === "event" && Permissions.has(session?.permission ?? 0, Permissions.WRITE_OFFICIAL) && <WriteFloatingAction to="/events/write" label={lang === "ko" ? "행사 등록" : "Create event"} />}
    </PageShell>
  );
}
