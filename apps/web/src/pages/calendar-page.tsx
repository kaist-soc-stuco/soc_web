import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Search } from 'lucide-react';

import { SiteLayout } from '@/components/organisms/site-layout';
import type { EventItem } from '@soc/contracts';

import { getEvents } from '@/lib/event-api';
import { localizedText } from '@/lib/localized-content';
type CalendarCategory = '전체' | '학사' | '행사' | '학생회' | '복지' | '연구';

interface CalendarEvent {
  id: string;
  date: string;
  endDate: string;
  title: string;
  category: Exclude<CalendarCategory, '전체'>;
  time: string;
  location: string;
  summary: string;
}

const calendarCategories: CalendarCategory[] = ['전체', '학사', '행사', '학생회', '복지', '연구'];

function formatTime(event: EventItem) {
  if (event.allDay) return '종일';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(event.startAtMs);
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function toCalendarEvent(event: EventItem): CalendarEvent {
  const date = event.allDay && event.allDayStartDate
    ? event.allDayStartDate
    : toDateKey(new Date(event.startAtMs));
  const endDate = event.allDay && event.allDayEndDate
    ? previousDateKey(event.allDayEndDate)
    : toDateKey(new Date(event.endAtMs - 1));

  return {
    id: event.id,
    date,
    endDate,
    title: localizedText(event.title),
    category: '행사',
    time: formatTime(event),
    location: event.location,
    summary: localizedText(event.description),
  };
}

function occursOn(event: CalendarEvent, dateKey: string) {
  return event.date <= dateKey && dateKey <= event.endDate;
}

const categoryStyles: Record<Exclude<CalendarCategory, '전체'>, string> = {
  학사: 'bg-[#dbeafe] text-[#1d4ed8]',
  행사: 'bg-kaist-lightgreen2/40 text-kaist-darkgreen',
  학생회: 'bg-kaist-darkgreen text-kaist-white',
  복지: 'bg-[#fef3c7] text-[#92400e]',
  연구: 'bg-[#ede9fe] text-[#6d28d9]',
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

export function CalendarPage() {
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [activeCategory, setActiveCategory] = useState<CalendarCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const fromMs = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getTime();
    const toMs = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1).getTime();
    let cancelled = false;

    setEvents([]);
    setLoadState('loading');
    getEvents(fromMs, toMs)
      .then((response) => {
        if (!cancelled) {
          setEvents(response.items.map(toCalendarEvent));
          setLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [viewDate]);

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = events.filter((event) => {
    const matchesCategory = activeCategory === '전체' || event.category === activeCategory;
    const matchesSearch =
      normalizedQuery.length === 0 ||
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.summary.toLowerCase().includes(normalizedQuery) ||
      event.location.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const date of monthDays) {
    const dateKey = toDateKey(date);
    eventsByDate.set(dateKey, filteredEvents.filter((event) => occursOn(event, dateKey)));
  }

  const selectedEvents = filteredEvents.filter((event) => occursOn(event, selectedDate));
  const upcomingEvents = filteredEvents.filter((event) => event.endDate >= selectedDate).slice(0, 5);

  const moveMonth = (offset: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
    setSelectedDate(toDateKey(next));
  };

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">전산학부 캘린더</h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">학사, 행사, 복지 일정을 한눈에 확인하세요</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-8`}>
          <div className="mb-5 grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-kaist-grey/25 text-kaist-darkgreen transition hover:bg-kaist-grey/10"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-[24px] font-extrabold tracking-tight text-kaist-black">
                  {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                </h2>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-kaist-grey/25 text-kaist-darkgreen transition hover:bg-kaist-grey/10"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <label className="flex min-w-[260px] items-center gap-3 border-b border-kaist-grey/30 pb-2">
                <Search className="h-5 w-5 text-kaist-greygreen" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="일정 검색"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-tight text-kaist-black placeholder:text-kaist-greygreen focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {calendarCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-extrabold tracking-tight transition ${
                    activeCategory === category
                      ? 'border-kaist-darkgreen bg-kaist-darkgreen text-kaist-white'
                      : 'border-kaist-grey/25 bg-white text-kaist-black hover:bg-kaist-grey/10'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          {loadState === 'loading' ? (
            <p className="mb-5 text-center text-[14px] font-semibold text-kaist-grey">일정을 불러오는 중입니다</p>
          ) : loadState === 'error' ? (
            <p className="mb-5 text-center text-[14px] font-semibold text-kaist-grey">일정을 불러오지 못했습니다</p>
          ) : events.length === 0 ? (
            <p className="mb-5 text-center text-[14px] font-semibold text-kaist-grey">이번 달 일정이 없습니다</p>
          ) : null}

          {loadState === 'ready' && events.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-[8px] border border-kaist-grey/25 bg-white">
              <div className="grid grid-cols-7 border-b border-kaist-grey/25 bg-[#F7FCFC] text-center text-[14px] font-extrabold tracking-tight text-kaist-greygreen">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className="py-3">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthDays.map((date) => {
                  const dateKey = toDateKey(date);
                  const dayEvents = eventsByDate.get(dateKey) ?? [];
                  const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                  const isSelected = dateKey === selectedDate;
                  const isToday = dateKey === toDateKey(new Date());

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`min-h-[112px] border-r border-t border-kaist-grey/15 p-2.5 text-left transition hover:bg-kaist-grey/5 ${
                        isSelected ? 'bg-kaist-lightgreen2/20' : 'bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-full text-[14px] font-extrabold ${
                            isToday
                              ? 'bg-kaist-darkgreen text-kaist-white'
                              : isCurrentMonth
                              ? 'text-kaist-black'
                              : 'text-kaist-grey/40'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {dayEvents.length > 0 ? (
                          <span className="text-[11px] font-bold text-kaist-greygreen">{dayEvents.length}건</span>
                        ) : null}
                      </div>

                      <div className="space-y-1.5">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div key={event.id} className={`truncate rounded-full px-2 py-1 text-[11px] font-bold ${categoryStyles[event.category]}`}>
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 ? <p className="text-[11px] font-bold text-kaist-grey">+{dayEvents.length - 2} more</p> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-[8px] border border-kaist-grey/25 bg-white p-5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-kaist-darkgreen" />
                  <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">{selectedDate}</h2>
                </div>

                <div className="mt-5 space-y-4">
                  {selectedEvents.length > 0 ? (
                    selectedEvents.map((event) => (
                      <article key={event.id} className="rounded-[8px] border border-kaist-grey/15 p-4">
                        <span className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${categoryStyles[event.category]}`}>{event.category}</span>
                        <h3 className="mt-3 text-[17px] font-extrabold tracking-tight text-kaist-black">{event.title}</h3>
                        <p className="mt-2 text-[13px] font-semibold leading-6 text-kaist-grey">{event.summary}</p>
                        <div className="mt-3 flex flex-col gap-2 text-[12px] font-bold text-kaist-greygreen">
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            {event.time}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="py-10 text-center text-[14px] font-semibold text-kaist-grey">선택한 날짜의 일정이 없습니다</p>
                  )}
                </div>
              </section>

              <section className="rounded-[8px] border border-kaist-grey/25 bg-white p-6">
                <h2 className="text-[20px] font-extrabold tracking-tight text-kaist-black">다가오는 일정</h2>
                <div className="mt-5 space-y-3">
                  {upcomingEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedDate(event.date)}
                      className="block w-full rounded-[8px] border border-kaist-grey/15 px-4 py-3 text-left transition hover:bg-kaist-grey/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-extrabold text-kaist-darkgreen">{event.date.slice(5).replace('-', '/')}</span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${categoryStyles[event.category]}`}>{event.category}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-extrabold tracking-tight text-kaist-black">{event.title}</p>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
            </div>
          ) : null}
        </section>
      </div>
    </SiteLayout>
  );
}
