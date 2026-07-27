import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import type { EventItem } from '@soc/contracts';

import { SiteLayout } from '@/components/organisms/site-layout';
import { getEvents } from '@/lib/event-api';
import { localizedText } from '@/lib/localized-content';
import { mockEvents } from '@/lib/mock-data';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const eventTabs = ['설문조사', '행사'] as const;
const EVENT_WINDOW_MS = 92 * 24 * 60 * 60 * 1000;

type EventTab = (typeof eventTabs)[number];

interface EventCard {
  id: string | number;
  title: string;
  summary: string;
  date: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  href: string;
  image?: string;
}

function formatEventDate(event: EventItem) {
  const start = new Date(event.startAtMs);
  return `${String(start.getFullYear()).slice(-2)}.${String(start.getMonth() + 1).padStart(2, '0')}.${String(start.getDate()).padStart(2, '0')}`;
}

export function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventLoadState, setEventLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const activeTab: EventTab = searchParams.get('type') === 'event' ? '행사' : '설문조사';

  useEffect(() => {
    if (activeTab !== '행사') {
      setEventLoadState('idle');
      return;
    }

    const now = Date.now();
    const fromMs = now - EVENT_WINDOW_MS / 2;
    const toMs = now + EVENT_WINDOW_MS / 2;
    let cancelled = false;

    setEvents([]);
    setEventLoadState('loading');
    getEvents(fromMs, toMs)
      .then((response) => {
        if (!cancelled) {
          setEvents(response.items);
          setEventLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setEventLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const cardEvents = useMemo<EventCard[]>(
    () =>
      activeTab === '행사'
        ? events.map((event) => ({
            id: event.id,
            title: localizedText(event.title),
            summary: localizedText(event.description),
            date: formatEventDate(event),
            status: event.startAtMs > Date.now() ? 'upcoming' : event.endAtMs > Date.now() ? 'ongoing' : 'completed',
            href: '/calendar',
          }))
        : Array.from({ length: 18 }, (_, index) => ({
            ...mockEvents[index % mockEvents.length],
            id: index + 1,
            href: `/events/${index + 1}/survey`,
          })),
    [activeTab, events],
  );

  const filteredEvents = cardEvents.filter((event) => event.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const cardsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / cardsPerPage));
  const currentEvents = filteredEvents.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
  const eventIsLoading = activeTab === '행사' && (eventLoadState === 'idle' || eventLoadState === 'loading');
  const eventHasError = activeTab === '행사' && eventLoadState === 'error';
  const canRenderCards = activeTab === '설문조사' || eventLoadState === 'ready';

  const handleTabChange = (tab: EventTab) => {
    setSearchParams({ type: tab === '행사' ? 'event' : 'survey' });
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const endPage = Math.min(totalPages, startPage + 4);

    for (let i = startPage; i <= endPage; i += 1) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <SiteLayout>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
        <div className={pageContainerClass}>
          <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-white">설문조사</h1>
          <p className="text-[20px] font-semibold tracking-tight text-white">카이스트 전산학부의 다양한 행사를 확인하고 설문에 참여하세요</p>
        </div>
      </div>

      <div className="border-b border-kaist-grey/30 bg-[#F7FCFC]">
          <div className={`${pageContainerClass} flex flex-wrap items-end justify-between gap-8`}>
          <div className="flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-10">
            {eventTabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className="group relative"
                onClick={() => handleTabChange(tab)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span
                  className={`relative flex h-full items-center justify-center text-lg font-extrabold tracking-tight transition-colors ${
                    activeTab === tab ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'
                  }`}
                >
                  <span className="py-3">{tab}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-1.5 origin-center bg-kaist-darkgreen transition-transform duration-200 ${
                      activeTab === tab ? 'scale-x-150' : hoveredIndex === index ? 'scale-x-150' : 'scale-x-0'
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="mb-2.5 flex items-center gap-2 border-b border-kaist-darkgreen/40">
            <span className="text-base font-semibold text-[#9AA69F]">제목</span>
            <span className="mb-2 text-base text-kaist-darkgreen">⌄</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="w-20 bg-transparent text-sm focus:outline-none"
              aria-label="행사 제목 검색"
            />
            <Search className="h-4 w-4 text-kaist-darkgreen" />
          </div>
        </div>
      </div>

      <section className={`${pageContainerClass} bg-[#F7FCFC] pb-16 pt-8`}>
        <div className="grid grid-cols-[repeat(auto-fit,270px)] justify-center gap-x-6 gap-y-[51px] min-[1900px]:justify-between">
          {canRenderCards && currentEvents.map((event) => (
            <Link
              key={event.id}
              to={event.href}
              className="group flex h-[359px] w-[270px] min-w-0 flex-col overflow-hidden rounded-lg bg-kaist-white shadow-[-1px_0_4px_rgba(0,0,0,0.22),1px_2px_4px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-[60.2%] min-h-[168px] flex-shrink-0 overflow-hidden rounded-t-md bg-kaist-greygreen/20">
                {event.image ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${event.image})` }}
                  />
                ) : null}
                <span className="absolute left-4 top-4 rounded-full bg-kaist-darkgreen px-3 py-1 text-[10px] font-semibold tracking-tight text-kaist-white lg:text-xs">
                  {event.status === 'upcoming' ? '예정' : event.status === 'ongoing' ? '진행중' : '완료'}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
                <span className="mb-1 text-[10px] font-bold tracking-tight text-[#5b93c4] lg:text-xs">이벤트</span>
                <h2 className="line-clamp-2 text-lg font-extrabold tracking-tight text-kaist-black lg:text-2xl">
                  {event.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-xs font-semibold leading-normal tracking-tight text-kaist-grey">
                  {event.summary}
                </p>
                <div className="mt-auto flex items-center gap-2 text-[10px] font-semibold tracking-tight text-kaist-greygreen lg:text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {event.date}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {eventIsLoading ? (
          <div className="py-20 text-center text-kaist-grey">
            <p className="text-base font-semibold">행사를 불러오는 중입니다</p>
          </div>
        ) : eventHasError ? (
          <div className="py-20 text-center text-kaist-grey">
            <p className="text-base font-semibold">행사를 불러오지 못했습니다</p>
          </div>
        ) : currentEvents.length === 0 ? (
          <div className="py-20 text-center text-kaist-grey">
            <p className="text-base font-semibold">행사가 없습니다</p>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-center gap-2 text-[12px] font-medium tracking-tight text-kaist-black">
          <button
            type="button"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`p-1 transition-colors ${
              currentPage === 1 ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'
            }`}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {getPageNumbers().map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => handlePageChange(page)}
                className={`h-[28px] min-w-[28px] rounded-[5px] px-2 transition-colors ${
                currentPage === page ? 'bg-kaist-darkgreen-main text-kaist-white' : 'text-kaist-black hover:bg-kaist-grey/10'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`p-2 transition-colors ${
              currentPage === totalPages ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'
            }`}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </SiteLayout>
  );
}
