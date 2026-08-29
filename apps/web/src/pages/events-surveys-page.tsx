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
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";
import {
  PageHeader,
  PageContainer,
  PageMain,
  PageShell,
} from "@/components/ui/page-layout";

export type EventsSurveysView = "event" | "survey" | "calendar";

export function EventsSurveysPage({ view }: { view?: EventsSurveysView }) {
  const [searchParams] = useSearchParams();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const currentTab = view ?? (searchParams.get("tab") as EventsSurveysView | null) ?? "event";
  const selectedParam = searchParams.get("selected");
  const {
    calendarEvents,
    calendarQuery,
    currentDate,
    dateFrom,
    dateTo,
    engagementSubmitting,
    error,
    holidays,
    handleSetEngagement,
    loading,
    selectedDate,
    setCurrentDate,
    setCalendarQuery,
    setDateFrom,
    setDateTo,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    visibleItems,
  } = useEventsSurveysPageController({
    currentTab,
    lang,
    selectedParam,
  });

  return (
    <PageShell>
      <Header />

      <PageMain>
        <PageHeader
          actions={
            currentTab === "survey" &&
            Permissions.hasAny(session?.permission ?? 0, Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL) ? (
              <Button asChild>
                <Link to="/admin/surveys/new">{lang === "ko" ? "등록" : "Create"}</Link>
              </Button>
            ) : currentTab === "event" &&
              Permissions.has(session?.permission ?? 0, Permissions.POST_CREATE) ? (
              <Button asChild>
                <Link to="/events/write">
                  {lang === "ko" ? "행사 등록" : "Create event"}
                </Link>
              </Button>
            ) : undefined
          }
          title={
            currentTab === "calendar"
              ? lang === "ko" ? "일정" : "Calendar"
              : currentTab === "survey"
                ? lang === "ko" ? "설문·투표" : "Surveys & Polls"
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
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
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
          ) : visibleItems.length === 0 ? (
            <div className="space-y-4 rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center">
              <div className="text-lg font-medium text-gray-300">
                {lang === "ko"
                  ? "표시할 항목이 없습니다."
                  : "No events or surveys to display."}
              </div>
              <p className="text-sm text-kaist-grey">
                {lang === "ko"
                  ? "다른 탭을 확인해 보세요."
                  : "Please check out the other tab."}
              </p>
            </div>
          ) : (
            <EventsSurveysGrid
              engagementSubmitting={engagementSubmitting}
              isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
              items={visibleItems}
              lang={lang}
              onEngagementToggle={handleSetEngagement}
            />
          )}
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
