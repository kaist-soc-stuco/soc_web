import { useSearchParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import { EventsSurveysCalendar } from "@/features/events-surveys/events-surveys-calendar";
import { EventsSurveysFilterBar } from "@/features/events-surveys/events-surveys-filter-bar";
import { EventsSurveysGrid } from "@/features/events-surveys/events-surveys-grid";
import { useEventsSurveysPageController } from "@/features/events-surveys/use-events-surveys-page-controller";
import { AlertCircle } from "lucide-react";

export function EventsSurveysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const currentTab = searchParams.get("tab") || "event";
  const selectedParam = searchParams.get("selected");
  const {
    calendarEvents,
    currentDate,
    error,
    holidays,
    loading,
    selectedDate,
    setCurrentDate,
    setSelectedDate,
    setSortBy,
    setStateFilter,
    sortBy,
    stateFilter,
    visibleItems,
  } = useEventsSurveysPageController({
    currentTab,
    lang,
    selectedParam,
  });

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: "event", labelKo: "행사", labelEn: "Events" },
    { id: "survey", labelKo: "설문·투표", labelEn: "Surveys & Votes" },
    { id: "calendar", labelKo: "일정", labelEn: "Calendar" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header showLogo />

      <PageHero
        title={lang === "ko" ? "행사 / 설문·투표" : "Events / Surveys & Votes"}
        variant="compact"
        showDescription={false}
        description={
          lang === "ko"
            ? "집행위원회가 진행하는 행사와 설문·투표를 한 곳에서 확인하고 참여하세요."
            : "Browse and join student council events, surveys, and votes in one place."
        }
      />

      {/* Underlined Tab-style Navigation matching the rest of the application */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white select-none">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex min-w-max gap-6 overflow-x-auto items-stretch">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`group relative flex min-h-11 items-center justify-center text-[14px] font-semibold transition-colors border-0 bg-transparent shrink-0 cursor-pointer ${
                    isActive
                      ? "text-brand-primary"
                      : "text-slate-400 hover:text-brand-primary"
                  }`}
                >
                  <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary transition-transform duration-200 origin-center ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 md:px-8 md:py-8">
        {currentTab !== "calendar" && !loading && !error ? (
          <EventsSurveysFilterBar
            lang={lang}
            onSortByChange={setSortBy}
            onStateFilterChange={setStateFilter}
            sortBy={sortBy}
            stateFilter={stateFilter}
            visibleCount={visibleItems.length}
          />
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400">
              {lang === "ko" ? "불러오는 중..." : "Loading..."}
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : currentTab === "calendar" ? (
          <EventsSurveysCalendar
            calendarEvents={calendarEvents}
            currentDate={currentDate}
            holidays={holidays}
            lang={lang}
            onCurrentDateChange={setCurrentDate}
            onSelectedDateChange={setSelectedDate}
            selectedDate={selectedDate}
          />
        ) : visibleItems.length === 0 ? (
          <div className="space-y-4 rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="text-gray-300 font-medium text-lg">
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
            items={visibleItems}
            lang={lang}
            onNavigate={navigate}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
