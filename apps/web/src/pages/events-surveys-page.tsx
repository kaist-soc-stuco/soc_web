import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { EventsSurveysCalendar } from "@/features/events-surveys/events-surveys-calendar";
import { EventsSurveysFilterBar } from "@/features/events-surveys/events-surveys-filter-bar";
import { EventsSurveysGrid } from "@/features/events-surveys/events-surveys-grid";
import { useEventsSurveysPageController } from "@/features/events-surveys/use-events-surveys-page-controller";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data-state";
import { Pagination } from "@/components/ui/pagination";
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";
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
      stateFilter === "before_open"
        ? "upcoming"
        : stateFilter === "open"
          ? "ongoing"
          : stateFilter === "closed"
            ? "closed"
            : "published";
    return `No ${status} ${subject} available.`;
  }

  if (view === "survey") {
    if (stateFilter === "before_open") return "시작 예정인 설문이 없습니다.";
    if (stateFilter === "open") return "진행 중인 설문이 없습니다.";
    if (stateFilter === "closed") return "마감된 설문이 없습니다.";
    return "등록된 설문이 없습니다.";
  }

  if (stateFilter === "before_open") return "시작 예정인 행사가 없습니다.";
  if (stateFilter === "open") return "진행 중인 행사가 없습니다.";
  if (stateFilter === "closed") return "마감된 행사가 없습니다.";
  return "등록된 행사가 없습니다.";
}

export function EventsSurveysPage({ view }: { view?: EventsSurveysView }) {
  const [searchParams] = useSearchParams();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const currentTab = view ?? (searchParams.get("tab") as EventsSurveysView | null) ?? "event";
  const selectedParam = searchParams.get("selected");
  const {
    calendarEvents,
    calendarQuery,
    currentPage,
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
    setCurrentPage,
    setDateFrom,
    setDateTo,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    totalItems,
    totalPages,
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
  const resetListFilters = () => {
    setItemQuery("");
    setDateFrom("");
    setDateTo("");
    setStateFilter("all");
  };

  return (
    <PageShell>
      <Header />

      <PageMain>
        <PageHeader
          actions={
            currentTab === "survey" &&
            Permissions.has(session?.permission ?? 0, Permissions.MANAGE_SURVEY) ? (
              <Button asChild>
                <Link to="/admin/surveys/new">{lang === "ko" ? "등록" : "Create"}</Link>
              </Button>
            ) : currentTab === "event" &&
              Permissions.has(session?.permission ?? 0, Permissions.WRITE_OFFICIAL) ? (
              <Button asChild>
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

        <PageContainer className="pb-8">
          {currentTab !== "calendar" && !loading && !error ? (
            <EventsSurveysFilterBar
              lang={lang}
              onQueryChange={setItemQuery}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onStateFilterChange={setStateFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              query={itemQuery}
              stateCounts={stateCounts}
              stateFilter={stateFilter}
            />
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-primary border-t-transparent" />
              <p className="text-xs font-semibold text-slate-400">
                {lang === "ko" ? "불러오는 중..." : "Loading..."}
              </p>
            </div>
          ) : error ? (
            <div
              className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700 sm:flex-row sm:items-center"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
              <Button
                className="min-h-11 shrink-0"
                onClick={retry}
                size="sm"
                type="button"
                variant="outline"
              >
                {lang === "ko" ? "다시 시도" : "Try again"}
              </Button>
            </div>
          ) : currentTab === "calendar" ? (
            <EventsSurveysCalendar
              calendarEvents={calendarEvents}
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
              <EventsSurveysGrid
                engagementSubmitting={engagementSubmitting}
                isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
                items={visibleItems}
                lang={lang}
                onEngagementToggle={handleSetEngagement}
              />
              <Pagination
                className="mt-6"
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                range={lang === "ko" ? `총 ${totalItems}건` : `${totalItems} total`}
                totalPages={totalPages}
                lang={lang}
              />
            </>
          )}
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
