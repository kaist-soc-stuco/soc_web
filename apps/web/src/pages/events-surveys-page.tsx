import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import type { ArticleListItem } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import {
  buildCalendarEvents,
  buildUnifiedItems,
  filterItemsByTab,
  getCardPeriodText,
  isClosedItem,
  isOpenItem,
  sortVisibleItems,
  stripCalendarPrefix,
  type CalendarEvent,
  type SurveyRecordWithState,
  type UnifiedItem,
} from "@/lib/events-surveys";
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  Vote,
  FileText,
  FileCheck,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export function EventsSurveysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const currentTab = searchParams.get("tab") || "event";
  const selectedParam = searchParams.get("selected");

  const [surveys, setSurveys] = useState<SurveyRecordWithState[]>([]);
  const [events, setEvents] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"latest" | "deadline">("latest");
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  // Calendar navigation states
  const [currentDate, setCurrentDate] = useState(() => nowDate());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Selection states for Calendar Tab
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (selectedParam) {
      const parsed = isoToDate(selectedParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return nowDate();
  });
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>(
    [],
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const fetchItems = () => {
    setLoading(true);
    Promise.all([
      apiClient.getPublicSurveys(),
      apiClient
        .getArticles("행사", { page: 1, limit: 100 })
        .catch(() => ({ items: [], total: 0 })),
    ])
      .then(([surveysData, eventsData]) => {
        setSurveys(surveysData);
        setEvents(eventsData.items);
        setError(null);
      })
      .catch(() => {
        setError(
          lang === "ko"
            ? "목록을 불러오는 중 오류가 발생했습니다."
            : "Failed to load events and surveys.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchItems();
  }, [apiClient]);

  // Sync selected query parameter from URL
  useEffect(() => {
    if (selectedParam) {
      const parsed = isoToDate(selectedParam);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentDate(parsed); // Automatically open the correct month
      }
    }
  }, [selectedParam]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    return buildUnifiedItems(surveys, events);
  }, [surveys, events]);

  // Filter items based on tab
  const filteredItems = useMemo(() => {
    return filterItemsByTab(unifiedItems, currentTab);
  }, [unifiedItems, currentTab]);

  const visibleItems = useMemo(() => {
    return sortVisibleItems(filteredItems, sortBy, showOpenOnly);
  }, [filteredItems, showOpenOnly, sortBy]);

  const activeItems = useMemo(
    () => visibleItems.filter((item) => !isClosedItem(item)),
    [visibleItems],
  );

  const closedItems = useMemo(
    () => visibleItems.filter((item) => isClosedItem(item)),
    [visibleItems],
  );

  // Dynamic calendar events parsed from items list
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return buildCalendarEvents(unifiedItems, lang);
  }, [unifiedItems, lang]);

  // Sync selected day details when calendarEvents load or selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const dayEvents = calendarEvents.filter((e) =>
        isSameDay(e.date, selectedDate),
      );
      setSelectedDayEvents(dayEvents);
      setSelectedDateStr(
        selectedDate.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        }),
      );
    }
  }, [calendarEvents, selectedDate, lang]);

  const getStatusBadge = (item: UnifiedItem) => {
    if (item.computedState === "before_open") {
      return {
        label: lang === "ko" ? "시작 전" : "Upcoming",
        color: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }
    if (item.computedState === "open") {
      let dDayText = "";
      if (item.closesAt) {
        const now = nowDate();
        const closeDate = isoToDate(item.closesAt);
        const d1 = localDate(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = localDate(
          closeDate.getFullYear(),
          closeDate.getMonth(),
          closeDate.getDate(),
        );
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          dDayText = `D-${diffDays}`;
        } else if (diffDays === 0) {
          dDayText = lang === "ko" ? "오늘 마감" : "D-Day";
        } else {
          dDayText = lang === "ko" ? "마감" : "Closed";
        }
      }
      return {
        label: dDayText
          ? `${lang === "ko" ? "진행중" : "Ongoing"} (${dDayText})`
          : lang === "ko"
            ? "진행중"
            : "Ongoing",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    return {
      label: lang === "ko" ? "마감" : "Closed",
      color: "bg-gray-100 text-gray-600 border-gray-200",
    };
  };

  // Calendar grid calculations
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = localDate(currentYear, currentMonth, 1);
    const lastDayOfMonth = localDate(currentYear, currentMonth + 1, 0);

    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const grid = [];

    // Pad preceding month days
    const prevMonthLastDay = localDate(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      grid.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: localDate(currentYear, currentMonth - 1, prevMonthLastDay - i),
      });
    }

    // Add current month days
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        day: i,
        isCurrentMonth: true,
        date: localDate(currentYear, currentMonth, i),
      });
    }

    // Pad following month days to fill 42 cells (6 rows)
    const totalCells = 42;
    const remainingCells = totalCells - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({
        day: i,
        isCurrentMonth: false,
        date: localDate(currentYear, currentMonth + 1, i),
      });
    }

    return grid;
  }, [currentYear, currentMonth]);

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Event kind colors in sidebar panel
  const getEventStyles = (kind: string) => {
    switch (kind) {
      case "VOTE":
        return {
          bg: "bg-purple-100 border-purple-300 font-extrabold text-purple-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-purple-600",
          label: lang === "ko" ? "투표" : "Vote",
          icon: Vote,
        };
      case "EVENT":
        return {
          bg: "bg-emerald-100 border-emerald-300 font-extrabold text-emerald-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-emerald-600",
          label: lang === "ko" ? "행사" : "Event",
          icon: CalendarIcon,
        };
      case "APPLICATION":
        return {
          bg: "bg-blue-100 border-blue-300 font-extrabold text-blue-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-blue-600",
          label: lang === "ko" ? "신청" : "Application",
          icon: FileCheck,
        };
      case "SURVEY":
      default:
        return {
          bg: "bg-teal-100 border-teal-300 font-extrabold text-teal-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-teal-600",
          label: lang === "ko" ? "설문" : "Survey",
          icon: FileText,
        };
    }
  };

  const handleSelectDay = (dayDate: Date) => {
    setSelectedDate(dayDate);
  };

  const handlePrevMonth = () => {
    setCurrentDate(localDate(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(localDate(currentYear, currentMonth + 1, 1));
  };

  const weekHeaders =
    lang === "ko"
      ? ["일", "월", "화", "수", "목", "금", "토"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const tabs = [
    { id: "event", labelKo: "행사", labelEn: "Events" },
    { id: "survey", labelKo: "설문·투표", labelEn: "Surveys & Votes" },
    { id: "calendar", labelKo: "일정", labelEn: "Calendar" },
  ];

  const getItemHref = (item: UnifiedItem) => {
    if (item.kind === "EVENT") {
      return `/board/행사/${item.id}`;
    }
    return isClosedItem(item) && item.resultVisibility === "PUBLIC"
      ? `/survey/${item.id}/results`
      : `/survey/${item.id}`;
  };

  const getActionLabel = (item: UnifiedItem) => {
    if (isOpenItem(item)) {
      return lang === "ko" ? "자세히 보기" : "View details";
    }
    if (item.resultVisibility === "PUBLIC") {
      return lang === "ko" ? "결과 보기" : "View results";
    }
    return "";
  };

  const getRestrictionMeta = (item: UnifiedItem) => {
    const meta: string[] = [];
    if (item.feePayersOnly) {
      meta.push(lang === "ko" ? "과비 납부자" : "Paid members only");
    }
    if (item.isKoreanOnly) {
      meta.push(lang === "ko" ? "한국어 사용자" : "Korean speakers only");
    }
    return meta.join(" · ");
  };

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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs select-none">
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
                      ? "text-kaist-darkgreen"
                      : "text-slate-400 hover:text-kaist-darkgreen"
                  }`}
                >
                  <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
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
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.015)] md:flex-row md:items-center md:justify-between">
            <div className="text-[13px] font-bold text-slate-600">
              {lang === "ko" ? (
                <span>
                  전체{" "}
                  <strong className="text-kaist-darkgreen">
                    {visibleItems.length}
                  </strong>
                  개
                </span>
              ) : (
                <span>
                  <strong className="text-kaist-darkgreen">
                    {visibleItems.length}
                  </strong>{" "}
                  items
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={showOpenOnly}
                  onChange={(event) => setShowOpenOnly(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-kaist-darkgreen focus:ring-kaist-darkgreen/20"
                />
                <span>
                  {lang === "ko" ? "진행 중인 항목만 보기" : "Ongoing only"}
                </span>
              </label>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "latest" | "deadline")
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
              >
                <option value="latest">
                  {lang === "ko" ? "최신순" : "Newest"}
                </option>
                <option value="deadline">
                  {lang === "ko" ? "마감 임박순" : "Deadline"}
                </option>
              </select>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-kaist-darkgreen border-t-transparent rounded-full animate-spin" />
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
          /* High-Fidelity Integrated Calendar Layout matching the revised design */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            {/* 1. Large Month Calendar Box (3/4 width) */}
            <div className="lg:col-span-3 bg-white rounded-3xl border border-kaist-grey/15 p-6 shadow-sm flex flex-col">
              {/* Calendar Grid Controller Header */}
              <div className="flex items-center justify-between pb-4 border-b border-kaist-grey/10 mb-5 select-none">
                <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-kaist-darkgreen-main whitespace-nowrap">
                  {currentYear}년 {currentMonth + 1}월
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 border border-kaist-grey/20 rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const today = nowDate();
                      setCurrentDate(today);
                      setSelectedDate(today);
                    }}
                    className="px-3 py-1.5 border border-kaist-grey/20 text-xs font-bold rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
                  >
                    {lang === "ko" ? "오늘" : "Today"}
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 border border-kaist-grey/20 rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekday Labels Header */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2 select-none">
                {weekHeaders.map((week, idx) => (
                  <div
                    key={idx}
                    className={`text-xs font-extrabold py-1.5 ${
                      idx === 0
                        ? "text-red-500"
                        : idx === 6
                          ? "text-blue-500"
                          : "text-kaist-greygreen"
                    }`}
                  >
                    {week}
                  </div>
                ))}
              </div>

              {/* Monthly Day Grid */}
              <div className="grid grid-cols-7 grid-rows-6 gap-1.5 min-h-[430px]">
                {calendarGrid.map((cell, idx) => {
                  const dayEvents = calendarEvents.filter((e) =>
                    isSameDay(e.date, cell.date),
                  );
                  const isToday = isSameDay(nowDate(), cell.date);
                  const isSelected =
                    selectedDate && isSameDay(selectedDate, cell.date);

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDay(cell.date)}
                      className={`min-h-[75px] p-2 rounded-xl text-left border flex flex-col justify-between items-start transition-all cursor-pointer relative group ${
                        cell.isCurrentMonth
                          ? isSelected
                            ? "bg-[#e6f4ea]/30 border-kaist-darkgreen/30"
                            : "bg-white hover:bg-slate-50/50 border-kaist-grey/10"
                          : isSelected
                            ? "bg-[#e6f4ea]/20 border-kaist-darkgreen/20 text-kaist-grey/40"
                            : "bg-slate-50/40 border-transparent text-kaist-grey/40"
                      }`}
                    >
                      {/* Day Label */}
                      <div className="flex items-center justify-between w-full select-none">
                        {isToday ? (
                          <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                            {cell.day}
                          </div>
                        ) : (
                          <span
                            className={`text-xs leading-none ${
                              isSelected
                                ? "text-kaist-darkgreen font-extrabold"
                                : cell.isCurrentMonth
                                  ? cell.date.getDay() === 0
                                    ? "text-red-500"
                                    : cell.date.getDay() === 6
                                      ? "text-blue-500"
                                      : "text-kaist-black"
                                  : "text-kaist-grey/40 font-bold"
                            } ${cell.isCurrentMonth && !isSelected ? "font-bold" : ""}`}
                          >
                            {cell.day}
                          </span>
                        )}
                      </div>

                      {/* Event Badges List (Light text-based style: plain text, green/red dot indicators, no color background fills) */}
                      <div className="w-full space-y-1 mt-2.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map((event, eventIdx) => {
                          const isStart = event.dateType === "open";
                          const shortTitle = stripCalendarPrefix(event.title);

                          return (
                            <div
                              key={eventIdx}
                              className="w-full text-[9.5px] font-bold truncate leading-relaxed flex items-center gap-1.5 text-slate-600 hover:text-kaist-darkgreen"
                              title={event.title}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStart ? "bg-green-500" : "bg-red-500"}`}
                              />
                              <span className="truncate">{shortTitle}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[8px] font-bold text-slate-400 pl-2.5 select-none">
                            + {dayEvents.length - 2}
                          </div>
                        )}
                      </div>

                      {/* Preview Hover Tooltip for complete schedule details */}
                      {cell.isCurrentMonth && dayEvents.length > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900/95 text-white text-[10px] rounded-xl p-3 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-30 select-none flex flex-col gap-2 border border-white/10">
                          <div className="font-extrabold border-b border-white/15 pb-1 flex items-center justify-between text-[#5cdb7d]">
                            <span>
                              {cell.date.toLocaleDateString(
                                lang === "ko" ? "ko-KR" : "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </span>
                            <span>{dayEvents.length}개 일정</span>
                          </div>
                          <div className="flex flex-col gap-1.5 text-[9px] font-medium text-stone-200">
                            {dayEvents.map((e, eIdx) => {
                              const isStart = e.dateType === "open";
                              const label =
                                e.kind === "VOTE"
                                  ? "투표"
                                  : e.kind === "APPLICATION"
                                    ? "신청"
                                    : e.kind === "EVENT"
                                      ? "행사"
                                      : "설문";
                              const titleText = stripCalendarPrefix(e.title);

                              return (
                                <div
                                  key={eIdx}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="truncate flex items-center gap-1.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStart ? "bg-green-500" : "bg-red-500"}`}
                                    />
                                    <span className="truncate">
                                      {titleText}
                                    </span>
                                  </div>
                                  <span className="text-[8px] font-extrabold px-1 rounded-sm bg-white/10 text-white/85 shrink-0 uppercase select-none">
                                    {label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Compact Selected Day Details Panel (Expanded height to 500px, reduced cards padding and sizes) */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-kaist-grey/15 p-4.5 shadow-sm min-h-[380px] lg:h-[500px] sticky top-24 self-start flex flex-col justify-between">
              <div className="flex flex-col min-h-0 flex-1">
                <h3 className="text-base font-extrabold text-kaist-black border-b border-kaist-grey/10 pb-2.5 mb-3.5 flex items-center gap-2 select-none shrink-0">
                  <CalendarIcon className="w-4 h-4 text-kaist-darkgreen" />
                  <span>
                    {lang === "ko" ? "일정 상세조회" : "Day Schedule Details"}
                  </span>
                </h3>

                {selectedDateStr ? (
                  <div className="flex flex-col min-h-0 flex-1 space-y-4">
                    {/* Rich Date & Total Event Count wrapper card */}
                    <div className="bg-[#e6f4ea]/30 border border-kaist-darkgreen/10 rounded-2xl p-3 flex flex-col items-center gap-1 text-center shadow-xs select-none shrink-0">
                      <span className="text-[12.5px] font-black text-kaist-darkgreen">
                        {selectedDateStr}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-kaist-darkgreen text-white shadow-xs mt-1">
                        <CalendarIcon className="w-3 h-3" />
                        <span>
                          {lang === "ko"
                            ? `총 ${selectedDayEvents.length}개 일정`
                            : `${selectedDayEvents.length} Events`}
                        </span>
                      </span>
                    </div>

                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-12 space-y-2 flex-1 flex flex-col justify-center select-none">
                        <p className="text-sm font-semibold text-slate-400">
                          {lang === "ko"
                            ? "등록된 일정이 없습니다."
                            : "No events scheduled."}
                        </p>
                        <p className="text-xs text-slate-400/70">
                          {lang === "ko"
                            ? "다른 날짜를 선택해보세요."
                            : "Select another date."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[300px] lg:max-h-[330px]">
                        {selectedDayEvents.map((event, idx) => {
                          const style = getEventStyles(event.kind);
                          const eventDate = isoToDate(event.rawDate);
                          const formattedTime = eventDate.toLocaleTimeString(
                            lang === "ko" ? "ko-KR" : "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            },
                          );

                          const isStateOpen = event.computedState === "open";
                          const shortTitle = event.title
                            .replace(/^\[시작\]\s*/, "")
                            .replace(/^\[마감\]\s*/, "")
                            .replace(/^\[Start\]\s*/, "")
                            .replace(/^\[Deadline\]\s*/, "");

                          return (
                            <div
                              key={idx}
                              className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden shrink-0"
                            >
                              {/* Top border strip for event type branding */}
                              <div
                                className={`absolute top-0 left-0 right-0 h-0.5 ${style.bullet}`}
                              />

                              <div className="flex items-center justify-between select-none">
                                <span
                                  className={`text-[9px] font-black px-2 py-0.2 rounded-full border ${style.bg}`}
                                >
                                  {style.label}
                                </span>

                                <span
                                  className={`text-[9px] font-black px-2 py-0.2 rounded-full ${
                                    isStateOpen
                                      ? "bg-[#e6f4ea] text-[#137333]"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {isStateOpen
                                    ? lang === "ko"
                                      ? "진행중"
                                      : "Ongoing"
                                    : lang === "ko"
                                      ? "마감됨"
                                      : "Closed"}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <h4 className="text-[12.5px] font-bold text-slate-800 leading-snug">
                                  {shortTitle}
                                </h4>
                                {event.description && (
                                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] font-semibold text-slate-500 select-none">
                                <div className="flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3 h-3 text-slate-300 animate-pulse" />
                                  <span>{formattedTime}</span>
                                  <span className="text-slate-200">|</span>
                                  <span>
                                    {event.dateType === "open"
                                      ? lang === "ko"
                                        ? "시작"
                                        : "Starts"
                                      : lang === "ko"
                                        ? "마감"
                                        : "Ends"}
                                  </span>
                                </div>

                                <div className="flex gap-2">
                                  {event.kind === "EVENT" &&
                                    event.surveyId &&
                                    isStateOpen && (
                                      <Link
                                        to={`/survey/${event.surveyId}`}
                                        className="inline-flex items-center rounded-md bg-kaist-lightgreen/20 px-1.5 py-0.5 text-[9px] font-extrabold text-kaist-darkgreen hover:opacity-85 transition-all cursor-pointer mr-2"
                                      >
                                        <span>
                                          {lang === "ko"
                                            ? "신청 가능"
                                            : "Application open"}
                                        </span>
                                      </Link>
                                    )}
                                  <Link
                                    to={
                                      event.kind === "EVENT"
                                        ? `/board/행사/${event.id}`
                                        : `/survey/${event.id}`
                                    }
                                    className="inline-flex items-center gap-0.5 text-kaist-darkgreen hover:opacity-85 transition-all cursor-pointer text-[10px]"
                                  >
                                    <span>
                                      {event.kind === "EVENT"
                                        ? lang === "ko"
                                          ? "자세히 보기"
                                          : "View"
                                        : lang === "ko"
                                          ? "보기"
                                          : "View"}
                                    </span>
                                    <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-3 select-none flex-1 flex flex-col justify-center">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-kaist-greygreen">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-400 leading-relaxed px-4">
                      {lang === "ko"
                        ? "달력에서 날짜를 선택하여 상세 마감 일정을 확인해보세요."
                        : "Select a date on the calendar to view its detailed schedule."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
          /* Cards Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleItems.map((item, index) => {
              const statusInfo = getStatusBadge(item);

              const title =
                lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
              const desc =
                lang === "ko"
                  ? item.descriptionKo
                  : item.descriptionEn || item.descriptionKo;

              const hasCapacity = item.maxResponses && item.maxResponses > 0;
              const currentResponses = item.responseCount ?? 0;
              const fillPercentage = hasCapacity
                ? Math.min(
                    100,
                    (currentResponses / (item.maxResponses || 1)) * 100,
                  )
                : 0;
              const closed = isClosedItem(item);
              const previousItem = visibleItems[index - 1];
              const startsActiveSection = index === 0 && !closed;
              const startsClosedSection =
                closed && (index === 0 || !isClosedItem(previousItem));
              const restrictionMeta = getRestrictionMeta(item);
              const descriptionText =
                desc ||
                (lang === "ko"
                  ? "등록된 상세 설명이 없습니다."
                  : "No description provided.");

              return (
                <Fragment key={item.id}>
                  {startsActiveSection ? (
                    <div className="col-span-full pt-1">
                      <h2 className="text-base font-extrabold text-slate-900">
                        {lang === "ko" ? "진행 중" : "Ongoing"}{" "}
                        <span className="text-xs font-bold text-slate-400">
                          ({activeItems.length})
                        </span>
                      </h2>
                    </div>
                  ) : null}

                  {startsClosedSection ? (
                    <div className="col-span-full pt-3">
                      <h2 className="text-base font-extrabold text-slate-900">
                        {lang === "ko" ? "마감됨" : "Closed"}{" "}
                        <span className="text-xs font-bold text-slate-400">
                          ({closedItems.length})
                        </span>
                      </h2>
                    </div>
                  ) : null}

                  <div
                    key={item.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(getItemHref(item))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        navigate(getItemHref(item));
                      }
                    }}
                    className={`flex cursor-pointer flex-col justify-between space-y-3 border-gray-200 bg-white rounded-2xl border p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      closed
                        ? "border-slate-200 opacity-75 hover:opacity-95"
                        : ""
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Badge Row */}
                      <div className="flex flex-wrap items-center justify-start gap-1.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        {item.kind === "EVENT" && item.surveyId && !closed && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-kaist-lightgreen/20 text-kaist-darkgreen border border-kaist-darkgreen/10">
                            {lang === "ko" ? "신청 가능" : "Application open"}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-[1.05rem] font-extrabold text-kaist-black line-clamp-2 leading-snug">
                          {title}
                        </h3>
                        <p
                          className={`min-h-[2.25rem] text-[13px] line-clamp-2 leading-snug font-normal ${
                            desc ? "text-kaist-grey/80" : "text-kaist-grey/40"
                          }`}
                        >
                          {descriptionText}
                        </p>
                      </div>
                    </div>

                    {/* Progress & Metadata */}
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      {/* Response capacity bar if applicable */}
                      {hasCapacity && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold text-kaist-grey/80">
                            <span>
                              {lang === "ko"
                                ? "신청 현황"
                                : "Registration Status"}
                            </span>
                            <span>
                              {currentResponses} / {item.maxResponses} (
                              {Math.round(fillPercentage)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-kaist-darkgreen/80 h-full rounded-full transition-all duration-300"
                              style={{ width: `${fillPercentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-kaist-grey/75">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen/80" />
                        <span className="truncate">
                          {getCardPeriodText(item)}
                        </span>
                      </div>
                      <div
                        className={`flex min-h-[0.875rem] items-center gap-1.5 text-[11px] font-bold ${
                          restrictionMeta
                            ? "text-kaist-grey/65"
                            : "text-transparent"
                        }`}
                        aria-hidden={!restrictionMeta}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen/80" />
                        <span className="truncate">
                          {restrictionMeta || "-"}
                        </span>
                      </div>
                      {/* Action buttons */}
                      <div className="flex justify-end items-center pt-1 text-[12px] font-extrabold">
                        <span className="inline-flex items-center gap-1 text-kaist-darkgreen">
                          {getActionLabel(item) && (
                            <span>{getActionLabel(item)}</span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
