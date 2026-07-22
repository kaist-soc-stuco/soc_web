import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Search } from 'lucide-react';

import { SiteLayout } from '@/components/organisms/site-layout';

type CalendarCategory = '전체' | '학사' | '행사' | '학생회' | '복지' | '연구';

interface CalendarEvent {
  id: number;
  date: string;
  endDate?: string;
  title: string;
  category: Exclude<CalendarCategory, '전체'>;
  time: string;
  location: string;
  summary: string;
}

const calendarCategories: CalendarCategory[] = ['전체', '학사', '행사', '학생회', '복지', '연구'];

const calendarEvents: CalendarEvent[] = [
  {
    id: 1,
    date: '2026-05-06',
    title: '학생회 정기 회의',
    category: '학생회',
    time: '18:00',
    location: 'N1 회의실',
    summary: '5월 학생회 주요 사업과 건의사항 처리 현황을 점검합니다.',
  },
  {
    id: 2,
    date: '2026-05-08',
    endDate: '2026-05-10',
    title: 'Human of CS 신청기간',
    category: '행사',
    time: '상시',
    location: '온라인',
    summary: '전산학부 구성원 인터뷰 프로젝트 신청을 받습니다.',
  },
  {
    id: 3,
    date: '2026-05-14',
    title: '연구실 오픈랩 투어',
    category: '연구',
    time: '16:00',
    location: 'E3-1',
    summary: '연구실별 소개와 질의응답 세션을 진행합니다.',
  },
  {
    id: 4,
    date: '2026-05-18',
    title: '전산학부 체육대회',
    category: '행사',
    time: '13:00',
    location: '대운동장',
    summary: '학부 구성원이 함께 참여하는 봄 체육대회입니다.',
  },
  {
    id: 5,
    date: '2026-05-21',
    title: '시험기간 간식 배부',
    category: '복지',
    time: '19:00',
    location: 'N1 로비',
    summary: '중간고사 기간 구성원을 위한 간식 배부가 진행됩니다.',
  },
  {
    id: 6,
    date: '2026-05-27',
    title: '전공 설명회',
    category: '학사',
    time: '17:00',
    location: '양승택 오디토리움',
    summary: '전산학부 전공 이수 흐름과 로드맵을 안내합니다.',
  },
  {
    id: 7,
    date: '2026-06-03',
    title: '기말고사 준비 세션',
    category: '학사',
    time: '18:30',
    location: '온라인',
    summary: '주요 전공 과목 학습 팁과 질의응답을 공유합니다.',
  },
];

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
  const [viewDate, setViewDate] = useState(() => new Date(2026, 4, 1));
  const [selectedDate, setSelectedDate] = useState('2026-05-08');
  const [activeCategory, setActiveCategory] = useState<CalendarCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = calendarEvents.filter((event) => {
    const matchesCategory = activeCategory === '전체' || event.category === activeCategory;
    const matchesSearch =
      normalizedQuery.length === 0 ||
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.summary.toLowerCase().includes(normalizedQuery) ||
      event.location.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of filteredEvents) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }

  const selectedEvents = filteredEvents.filter((event) => event.date === selectedDate);
  const upcomingEvents = filteredEvents.filter((event) => event.date >= selectedDate).slice(0, 5);

  const moveMonth = (offset: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-12">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[36px] font-extrabold tracking-tight text-kaist-white">전산학부 캘린더</h1>
            <p className="text-[24px] font-semibold tracking-tight text-kaist-white">학사, 행사, 복지 일정을 한눈에 확인하세요</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-10`}>
          <div className="mb-6 grid gap-4 rounded-[8px] border border-kaist-grey/25 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-kaist-grey/25 text-kaist-darkgreen transition hover:bg-kaist-grey/10"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-[28px] font-extrabold tracking-tight text-kaist-black">
                  {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                </h2>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-kaist-grey/25 text-kaist-darkgreen transition hover:bg-kaist-grey/10"
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
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-extrabold tracking-tight transition ${
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-[8px] border border-kaist-grey/25 bg-white">
              <div className="grid grid-cols-7 border-b border-kaist-grey/25 bg-[#F7FCFC] text-center text-[15px] font-extrabold tracking-tight text-kaist-greygreen">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className="py-4">
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
                  const isToday = dateKey === '2026-05-08';

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`min-h-[132px] border-r border-t border-kaist-grey/15 p-3 text-left transition hover:bg-kaist-grey/5 ${
                        isSelected ? 'bg-kaist-lightgreen2/20' : 'bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full text-[15px] font-extrabold ${
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

            <aside className="space-y-6">
              <section className="rounded-[8px] border border-kaist-grey/25 bg-white p-6">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-kaist-darkgreen" />
                  <h2 className="text-[20px] font-extrabold tracking-tight text-kaist-black">{selectedDate}</h2>
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
        </section>
      </div>
    </SiteLayout>
  );
}
