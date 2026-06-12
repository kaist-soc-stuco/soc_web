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
    <div className="flex min-h-screen flex-col bg-slate-50/40">
      <Header showLogo />

      <PageHero
        title={lang === "ko" ? "행사 / 설문·투표" : "Events / Surveys & Votes"}
        description={
          lang === "ko"
            ? "집행위원회가 진행하는 행사와 설문·투표를 한 곳에서 확인하고 참여하세요."
            : "Browse and join student council events, surveys, and votes in one place."
        }
      />

      {/* Underlined Tab-style Navigation matching the rest of the application */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-card select-none">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex gap-8 overflow-x-auto items-stretch">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center justify-center text-[14px] lg:text-[14.5px] font-bold tracking-tight transition-all py-4 border-0 bg-transparent shrink-0 cursor-pointer ${
                    isActive
                      ? "text-brand-primary"
                      : "text-slate-400 hover:text-brand-primary"
                  }`}
                >
                  <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[3px] bg-brand-primary transition-transform duration-200 origin-center ${
                      isActive ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 md:px-8">
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
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl text-sm font-medium flex items-center gap-3">
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
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-3xl bg-white space-y-4">
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
