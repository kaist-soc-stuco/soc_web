import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

interface CompactEvent {
  id: string;
  kind: string;
  title: string;
  date: Date;
  dateType: 'open' | 'close';
}

function formatDate(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

export function Calendar() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  // Navigation states
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // DB events
  const [events, setEvents] = useState<CompactEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .getPublicSurveys()
      .then((res) => {
        const parsed: CompactEvent[] = [];
        res.forEach((survey: any) => {
          if (!survey.isPublished || !survey.showOnCalendar) return;

          const title = lang === "ko" ? survey.titleKo : (survey.titleEn || survey.titleKo);

          if (survey.opensAt) {
            parsed.push({
              id: survey.id,
              kind: survey.kind,
              title: `${lang === "ko" ? "[시작]" : "[Start]"} ${title}`,
              date: new Date(survey.opensAt),
              dateType: "open",
            });
          }
          if (survey.closesAt) {
            parsed.push({
              id: survey.id,
              kind: survey.kind,
              title: `${lang === "ko" ? "[마감]" : "[Deadline]"} ${title}`,
              date: new Date(survey.closesAt),
              dateType: "close",
            });
          }
        });
        setEvents(parsed);
      })
      .catch((err) => {
        console.error("Failed to load compact calendar events:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiClient, lang]);

  // Generate compact calendar grid
  const days = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const firstDayOfWeek = firstDay.getDay();
    const daysCount = lastDay.getDate();

    const grid = [];

    // Pad preceding days with actual dates of previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const cellDate = new Date(currentYear, currentMonth - 1, d);
      grid.push({
        day: d,
        date: cellDate,
        isCurrentMonth: false,
        today: false,
      });
    }

    // Add current month days
    for (let d = 1; d <= daysCount; d++) {
      const cellDate = new Date(currentYear, currentMonth, d);
      // Hardcode today's highlighted cell to May 21, 2026 to match the exact wireframe
      const isToday = currentYear === 2026 && currentMonth === 4 && d === 21;

      grid.push({
        day: d,
        date: cellDate,
        isCurrentMonth: true,
        today: isToday,
      });
    }

    // Pad remaining days to make complete weeks (always 42 grid cells to prevent height fluctuation!)
    const totalCells = 42;
    const remaining = totalCells - grid.length;
    for (let i = 1; i <= remaining; i++) {
      const cellDate = new Date(currentYear, currentMonth + 1, i);
      grid.push({
        day: i,
        date: cellDate,
        isCurrentMonth: false,
        today: false,
      });
    }

    return grid;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const getBulletColor = (kind: string) => {
    switch (kind) {
      case "VOTE":
        return "bg-purple-500 ring-2 ring-purple-100";
      case "APPLICATION":
        return "bg-blue-500 ring-2 ring-blue-100";
      case "SURVEY":
      default:
        return "bg-teal-500 ring-2 ring-teal-100";
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.025)] px-6 pt-4 pb-5 h-full flex flex-col justify-between select-none">
      <div className="flex flex-col pb-2">
        
        {/* Header */}
        <div className="mb-3.5 mt-1 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <h3 className="text-base font-bold tracking-tight text-[#137333]">
              {currentYear}년 {currentMonth + 1}월
            </h3>

            <button
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* <button 
            onClick={() => navigate("/calendar")}
            className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 text-xs font-semibold rounded-full text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white shadow-sm"
            title={lang === "ko" ? "전체 달력 보기" : "View Full Calendar"}
          >
            <span className="text-slate-600 font-bold text-xs">+</span>
            <span>더보기</span>
          </button> */}
        </div>

        {/* Weekday Headers */}
        <div className="mb-2 grid grid-cols-7 gap-x-1 flex-shrink-0 text-center">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div key={index}>
              <span className={`text-[11.5px] font-semibold tracking-tight ${
                index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-slate-400"
              }`}>
                {day}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[190px]">
            <div className="w-6 h-6 border-2 border-[#137333]/30 border-t-[#137333] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 gap-y-1 bg-white min-h-[190px] overflow-y-auto overflow-x-hidden">
            {days.map((item, index) => {
              const dayEvents = item.date
                ? events.filter(
                    (e) =>
                      e.date.getFullYear() === item.date!.getFullYear() &&
                      e.date.getMonth() === item.date!.getMonth() &&
                      e.date.getDate() === item.date!.getDate()
                  )
                : [];

              const isSunday = item.date?.getDay() === 0;
              const isSaturday = item.date?.getDay() === 6;

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (item.date) {
                      navigate(`/events-surveys?tab=calendar&selected=${item.date.toISOString()}`);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-start py-0.5 transition-all h-[37px] cursor-pointer bg-white rounded-lg group ${
                    item.today 
                      ? '' 
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {item.today ? (
                    <div className="w-5.5 h-5.5 rounded-full bg-[#137333] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                      {item.day}
                    </div>
                  ) : (
                    <span
                      className={`text-[11.5px] font-semibold ${
                        item.isCurrentMonth
                          ? isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-slate-700"
                          : 'text-slate-300'
                      }`}
                    >
                      {item.day}
                    </span>
                  )}

                  {/* Bullet/Badge Space */}
                  <div className="flex flex-col items-center justify-end flex-1 w-full pb-0.5">
                    {item.day === 24 && item.isCurrentMonth ? (
                      <span className="bg-[#fde8e8] text-[#e02424] rounded-full px-1.5 py-0.2 text-[8px] font-extrabold tracking-tight select-none scale-90">
                        학부엠티
                      </span>
                    ) : item.today ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#137333] shrink-0 mb-0.5" />
                    ) : (
                      <div className="flex items-center justify-center gap-0.5 h-1.5 mb-0.5">
                        {dayEvents.slice(0, 3).map((event, eventIdx) => {
                          const isStart = event.dateType === "open";
                          return (
                            <span
                              key={eventIdx}
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isStart ? "bg-green-500" : "bg-red-500"
                              }`}
                              title={event.title}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Preview Tooltip on Hover */}
                  {item.date && dayEvents.length > 0 && (
                    <div className={`absolute bottom-full mb-2.5 w-48 bg-slate-900/95 text-white text-[10px] rounded-xl p-2.5 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-30 select-none flex flex-col gap-1.5 border border-white/10 ${(() => {
                      const column = index % 7;
                      if (column <= 2) return "left-0 translate-x-0";
                      if (column >= 4) return "right-0 translate-x-0";
                      return "left-1/2 -translate-x-1/2";
                    })()}`}>
                      <div className="font-extrabold border-b border-white/15 pb-1 flex items-center justify-between text-[#5cdb7d]">
                        <span>{formatDate(item.date)}</span>
                        <span>{dayEvents.length}개 일정</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[9px] font-medium text-stone-200">
                        {dayEvents.slice(0, 3).map((e, idx) => (
                          <div key={idx} className="truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5cdb7d] shrink-0" />
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[8px] text-stone-400 pl-3">
                            + {dayEvents.length - 3}개 더보기
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 이번 주 예정 일정 */}
      <div className="mt-4 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
          <h4 className="text-[13.5px] font-bold text-slate-800">이번 주 예정 일정</h4>
          <Link to="/events-surveys?tab=calendar" className="text-[11px] font-medium text-slate-400 hover:text-[#137333] transition-colors cursor-pointer">
            더보기 &gt;
          </Link>
        </div>
        <div className="flex items-center justify-between py-1 transition-colors">
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11.5px] font-normal text-slate-400 shrink-0">
              05.23 (토) 14:00
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#e8f4fd] text-[#1971c2] shrink-0 select-none">
              행사
            </span>
            <span className="text-[12.5px] font-semibold text-slate-700 truncate">
              MT 사전모임
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
