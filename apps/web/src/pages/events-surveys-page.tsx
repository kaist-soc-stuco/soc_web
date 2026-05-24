import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  CheckCircle, 
  BarChart3, 
  ArrowRight,
  Vote,
  FileText,
  FileCheck,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatKoreanDateTime } from "@soc/shared";

interface SurveyRecordWithState {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  status: string;
  computedState: string;
  feePayersOnly: boolean;
  allowAnonymous: boolean;
  isKoreanOnly: boolean;
  opensAt: string | null;
  closesAt: string | null;
  responseCount?: number;
  maxResponses?: number | null;
}

export function EventsSurveysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const currentTab = searchParams.get("tab") || "event";
  const selectedParam = searchParams.get("selected");

  const [items, setItems] = useState<SurveyRecordWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar navigation states
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Selection states for Calendar Tab
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (selectedParam) {
      const parsed = new Date(selectedParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .getPublicSurveys()
      .then((res) => {
        setItems(res as SurveyRecordWithState[]);
        setError(null);
      })
      .catch(() => {
        setError(lang === "ko" ? "목록을 불러오는 중 오류가 발생했습니다." : "Failed to load events and surveys.");
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
      const parsed = new Date(selectedParam);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentDate(parsed); // Automatically open the correct month
      }
    }
  }, [selectedParam]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  // Filter items based on tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (currentTab === "survey") {
        return item.kind === "SURVEY" || item.kind === "VOTE";
      }
      return item.kind === "APPLICATION";
    });
  }, [items, currentTab]);

  // Dynamic calendar events parsed from items list
  const calendarEvents = useMemo(() => {
    const parsed: any[] = [];
    items.forEach((survey) => {
      const title = lang === "ko" ? survey.titleKo : (survey.titleEn || survey.titleKo);
      const description = lang === "ko" ? (survey.descriptionKo || "") : (survey.descriptionEn || survey.descriptionKo || "");

      if (survey.opensAt) {
        parsed.push({
          id: survey.id,
          kind: survey.kind,
          title: `${lang === "ko" ? "[시작]" : "[Start]"} ${title}`,
          description,
          dateType: "open",
          rawDate: survey.opensAt,
          date: new Date(survey.opensAt),
          status: survey.status,
          computedState: survey.computedState,
        });
      }

      if (survey.closesAt) {
        parsed.push({
          id: survey.id,
          kind: survey.kind,
          title: `${lang === "ko" ? "[마감]" : "[Deadline]"} ${title}`,
          description,
          dateType: "close",
          rawDate: survey.closesAt,
          date: new Date(survey.closesAt),
          status: survey.status,
          computedState: survey.computedState,
        });
      }
    });
    return parsed;
  }, [items, lang]);

  // Sync selected day details when calendarEvents load or selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const dayEvents = calendarEvents.filter((e) => isSameDay(e.date, selectedDate));
      setSelectedDayEvents(dayEvents);
      setSelectedDateStr(
        selectedDate.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        })
      );
    }
  }, [calendarEvents, selectedDate, lang]);

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "VOTE":
        return {
          label: lang === "ko" ? "투표" : "Vote",
          color: "bg-purple-50 text-purple-700 border-purple-200",
          icon: Vote
        };
      case "APPLICATION":
        return {
          label: lang === "ko" ? "신청" : "Application",
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: FileCheck
        };
      case "SURVEY":
      default:
        return {
          label: lang === "ko" ? "설문" : "Survey",
          color: "bg-teal-50 text-teal-700 border-teal-200",
          icon: FileText
        };
    }
  };

  const getStatusBadge = (item: SurveyRecordWithState) => {
    if (item.computedState === "before_open") {
      return {
        label: lang === "ko" ? "시작 전" : "Upcoming",
        color: "bg-amber-50 text-amber-700 border-amber-200"
      };
    }
    if (item.computedState === "open") {
      let dDayText = "";
      if (item.closesAt) {
        const now = new Date();
        const closeDate = new Date(item.closesAt);
        const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = new Date(closeDate.getFullYear(), closeDate.getMonth(), closeDate.getDate());
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
        label: dDayText ? `${lang === "ko" ? "진행중" : "Ongoing"} (${dDayText})` : (lang === "ko" ? "진행중" : "Ongoing"),
        color: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    }
    return {
      label: lang === "ko" ? "마감" : "Closed",
      color: "bg-gray-100 text-gray-600 border-gray-200"
    };
  };

  // Calendar grid calculations
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const grid = [];

    // Pad preceding month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      grid.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i),
      });
    }

    // Add current month days
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(currentYear, currentMonth, i),
      });
    }

    // Pad following month days to fill 42 cells (6 rows)
    const totalCells = 42;
    const remainingCells = totalCells - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth + 1, i),
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
          icon: Vote
        };
      case "APPLICATION":
        return {
          bg: "bg-blue-100 border-blue-300 font-extrabold text-blue-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-blue-600",
          label: lang === "ko" ? "신청" : "Application",
          icon: FileCheck
        };
      case "SURVEY":
      default:
        return {
          bg: "bg-teal-100 border-teal-300 font-extrabold text-teal-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          bullet: "bg-teal-600",
          label: lang === "ko" ? "설문" : "Survey",
          icon: FileText
        };
    }
  };

  const handleSelectDay = (dayDate: Date) => {
    setSelectedDate(dayDate);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const weekHeaders = lang === "ko" 
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        description={lang === "ko"
          ? "집행위원회가 진행하는 행사와 설문·투표를 한 곳에서 확인하고 참여하세요."
          : "Browse and join student council events, surveys, and votes in one place."}
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
                      const today = new Date();
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
                      idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-kaist-greygreen"
                    }`}
                  >
                    {week}
                  </div>
                ))}
              </div>

              {/* Monthly Day Grid */}
              <div className="grid grid-cols-7 grid-rows-6 gap-1.5 min-h-[430px]">
                {calendarGrid.map((cell, idx) => {
                  const dayEvents = calendarEvents.filter((e) => isSameDay(e.date, cell.date));
                  const isToday = isSameDay(new Date(), cell.date);
                  const isSelected = selectedDate && isSameDay(selectedDate, cell.date);

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
                      {/* Day Label (No extra pill padding wrapper to guarantee constant cell grid height!) */}
                      <div className="flex items-center justify-between w-full select-none">
                        <span 
                          className={`text-xs leading-none ${
                            isSelected 
                              ? "text-kaist-darkgreen font-extrabold" 
                              : cell.isCurrentMonth
                              ? cell.date.getDay() === 0 ? "text-red-500" : cell.date.getDay() === 6 ? "text-blue-500" : "text-kaist-black"
                              : "text-kaist-grey/40 font-bold"
                          } ${cell.isCurrentMonth && !isSelected ? "font-bold" : ""}`}
                        >
                          {cell.day}
                        </span>
                        
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#137333] shrink-0" title={lang === "ko" ? "오늘" : "Today"} />
                        )}
                      </div>

                      {/* Event Badges List (Light text-based style: plain text, green/red dot indicators, no color background fills) */}
                      <div className="w-full space-y-1 mt-2.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map((event, eventIdx) => {
                          const isStart = event.dateType === "open";
                          const shortTitle = event.title
                            .replace(/^\[시작\]\s*/, "")
                            .replace(/^\[마감\]\s*/, "")
                            .replace(/^\[Start\]\s*/, "")
                            .replace(/^\[Deadline\]\s*/, "");

                          return (
                            <div 
                              key={eventIdx}
                              className="w-full text-[9.5px] font-bold truncate leading-relaxed flex items-center gap-1.5 text-slate-600 hover:text-kaist-darkgreen"
                              title={event.title}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStart ? "bg-green-500" : "bg-red-500"}`} />
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
                              {cell.date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span>{dayEvents.length}개 일정</span>
                          </div>
                          <div className="flex flex-col gap-1.5 text-[9px] font-medium text-stone-200">
                            {dayEvents.map((e: any, eIdx) => {
                              const isStart = e.dateType === "open";
                              const label = e.kind === "VOTE" ? "투표" : e.kind === "APPLICATION" ? "신청" : "설문";
                              const titleText = e.title
                                .replace(/^\[시작\]\s*/, "")
                                .replace(/^\[마감\]\s*/, "")
                                .replace(/^\[Start\]\s*/, "")
                                .replace(/^\[Deadline\]\s*/, "");

                              return (
                                <div key={eIdx} className="flex items-center justify-between gap-2">
                                  <div className="truncate flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStart ? "bg-green-500" : "bg-red-500"}`} />
                                    <span className="truncate">{titleText}</span>
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
                  <span>{lang === "ko" ? "일정 상세조회" : "Day Schedule Details"}</span>
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
                        <span>{lang === "ko" ? `총 ${selectedDayEvents.length}개 일정` : `${selectedDayEvents.length} Events`}</span>
                      </span>
                    </div>

                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-12 space-y-2 flex-1 flex flex-col justify-center select-none">
                        <p className="text-sm font-semibold text-slate-400">
                          {lang === "ko" ? "등록된 일정이 없습니다." : "No events scheduled."}
                        </p>
                        <p className="text-xs text-slate-400/70">
                          {lang === "ko" ? "다른 날짜를 선택해보세요." : "Select another date."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[300px] lg:max-h-[330px]">
                        {selectedDayEvents.map((event, idx) => {
                          const style = getEventStyles(event.kind);
                          const eventDate = new Date(event.rawDate);
                          const formattedTime = eventDate.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                          });
                          
                          const isStateOpen = event.computedState === "open";
                          const shortTitle = event.title
                            .replace(/^\[시작\]\s*/, "")
                            .replace(/^\[마감\]\s*/, "")
                            .replace(/^\[Start\]\s*/, "")
                            .replace(/^\[Deadline\]\s*/, "");

                          return (
                            <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2 shadow-xs hover:shadow-sm transition-shadow relative overflow-hidden shrink-0">
                              {/* Top border strip for event type branding */}
                              <div className={`absolute top-0 left-0 right-0 h-0.5 ${style.bullet}`} />

                              <div className="flex items-center justify-between select-none">
                                <span className={`text-[9px] font-black px-2 py-0.2 rounded-full border ${style.bg}`}>
                                  {style.label}
                                </span>
                                
                                <span className={`text-[9px] font-black px-2 py-0.2 rounded-full ${
                                  isStateOpen 
                                    ? "bg-[#e6f4ea] text-[#137333]" 
                                    : "bg-slate-100 text-slate-500"
                                }`}>
                                  {isStateOpen ? (lang === "ko" ? "진행중" : "Ongoing") : (lang === "ko" ? "마감됨" : "Closed")}
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
                                  <span>{event.dateType === "open" ? (lang === "ko" ? "시작" : "Starts") : (lang === "ko" ? "마감" : "Ends")}</span>
                                </div>

                                <Link
                                  to={`/survey/${event.id}`}
                                  className="inline-flex items-center gap-0.5 text-kaist-darkgreen hover:opacity-85 transition-all cursor-pointer"
                                >
                                  <span>{lang === "ko" ? "참여하기" : "View"}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
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
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-3xl bg-white space-y-4">
            <div className="text-gray-300 font-medium text-lg">
              {lang === "ko" ? "표시할 항목이 없습니다." : "No events or surveys to display."}
            </div>
            <p className="text-sm text-kaist-grey">
              {lang === "ko" ? "다른 탭을 확인해 보세요." : "Please check out the other tab."}
            </p>
          </div>
        ) : (
          /* Cards Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const kindInfo = getKindBadge(item.kind);
              const statusInfo = getStatusBadge(item);
              const Icon = kindInfo.icon;

              const title = lang === "ko" ? item.titleKo : (item.titleEn || item.titleKo);
              const desc = lang === "ko" ? item.descriptionKo : (item.descriptionEn || item.descriptionKo);

              const hasCapacity = item.maxResponses && item.maxResponses > 0;
              const currentResponses = item.responseCount ?? 0;
              const fillPercentage = hasCapacity ? Math.min(100, (currentResponses / (item.maxResponses || 1)) * 100) : 0;

              return (
                <div 
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-3xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3.5">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${kindInfo.color}`}>
                          <Icon className="w-3 h-3" />
                          {kindInfo.label}
                        </span>
                        {item.feePayersOnly && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {lang === "ko" ? "Paid Members Only" : "Paid Members Only"}
                          </span>
                        )}
                        {item.isKoreanOnly && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {lang === "ko" ? "Korean Speakers Only" : "Korean Speakers Only"}
                          </span>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-2">
                      <h3 className="text-xl md:text-[1.35rem] font-extrabold text-kaist-black line-clamp-1 leading-tight">
                        {title}
                      </h3>
                      {desc && (
                        <p className="text-sm text-kaist-grey/80 line-clamp-2 leading-relaxed font-normal">
                          {desc}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress & Metadata */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    {/* Response capacity bar if applicable */}
                    {hasCapacity && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-kaist-grey/80">
                          <span>{lang === "ko" ? "신청 현황" : "Registration Status"}</span>
                          <span>{currentResponses} / {item.maxResponses} ({Math.round(fillPercentage)}%)</span>
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
                    <div className="flex flex-col gap-1.5 text-xs text-kaist-grey/75 font-medium">
                      {item.opensAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-kaist-greygreen/80" />
                          <span>
                            {lang === "ko" ? "시작:" : "Start:"} {formatKoreanDateTime(item.opensAt)}
                          </span>
                        </div>
                      )}
                      {item.closesAt && (
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-kaist-greygreen/80" />
                          <span>
                            {lang === "ko" ? "마감:" : "End:"} {formatKoreanDateTime(item.closesAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2">
                      {item.computedState === "open" ? (
                        <button
                          onClick={() => navigate(`/survey/${item.id}`)}
                          className="w-full flex items-center justify-center gap-2 bg-kaist-darkgreen/90 hover:bg-kaist-darkgreen text-white/95 font-semibold text-sm py-2.5 rounded-xl transition-all shadow-sm shadow-kaist-darkgreen/10 border-0 cursor-pointer"
                        >
                          <span>{lang === "ko" ? "참여하기" : "Participate"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : item.computedState === "closed" && item.resultVisibility === "PUBLIC" ? (
                        <button
                          onClick={() => navigate(`/survey/${item.id}/results`)}
                          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-kaist-darkgreen/80 font-semibold text-sm py-2.5 rounded-xl transition-all border border-kaist-darkgreen/20 cursor-pointer"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>{lang === "ko" ? "결과 보기" : "View Results"}</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-semibold text-sm py-2.5 rounded-xl border border-gray-200 cursor-not-allowed"
                        >
                          {item.computedState === "before_open" ? (
                            <span>{lang === "ko" ? "개시 예정" : "Upcoming"}</span>
                          ) : (
                            <span>{lang === "ko" ? "마감됨" : "Closed"}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
