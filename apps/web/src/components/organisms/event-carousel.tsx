import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventItem } from '@soc/contracts';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUpcomingEvents } from '@/lib/event-api';
import { localizedText } from '@/lib/localized-content';
import { formatScheduleDate, formatScheduleDateTime } from '@/lib/schedule-date';
const DEFAULT_EVENT_IMAGE = '/hero_background2.jpeg';
interface EventCardProps {
    id: string;
    title: string;
    date: string;
    status: 'ongoing' | 'upcoming';
    summary: string;
}
const formatEventDate = (event: EventItem): string => {
    if (event.allDay && event.allDayStartDate) {
        return formatScheduleDate(event.allDayStartDate);
    }
    return formatScheduleDateTime(event.startAtMs);
};
const toEventCard = (event: EventItem, now: number): EventCardProps => ({
    id: event.id,
    title: localizedText(event.title),
    date: formatEventDate(event),
    status: event.startAtMs <= now && now < event.endAtMs ? 'ongoing' : 'upcoming',
    summary: localizedText(event.description),
});
function EventCard({ id, title, date, status, summary }: EventCardProps) {
    return (<Link to={`/calendar?eventId=${encodeURIComponent(id)}`} className="group flex aspect-[270/359] h-auto max-h-full min-h-[260px] w-full min-w-0 flex-col self-center overflow-hidden rounded-lg bg-kaist-white shadow-[-1px_0_4px_rgba(0,0,0,0.18),1px_2px_4px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-md md:min-h-[300px] lg:min-h-[320px]">
      <div className="relative h-[52%] flex-shrink-0 overflow-hidden rounded-t-md bg-kaist-greygreen/20">
        <img src={DEFAULT_EVENT_IMAGE} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"/>
        <span className="absolute left-3 top-3 rounded-full bg-kaist-darkgreen px-2.5 py-1 text-[10px] font-semibold tracking-tight text-kaist-white">
          {status === 'ongoing' ? uiText("components.organisms.event-carousel.0dae9079ff") : uiText("components.organisms.event-carousel.7ba9542c96")}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5">
        <span className="mb-1 text-[10px] font-bold tracking-tight text-[#5b93c4]">{uiText("components.organisms.event-carousel.bff20dc3bb")}</span>
        <h3 className="line-clamp-2 text-base font-extrabold leading-snug tracking-tight text-kaist-black lg:text-lg">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-normal tracking-tight text-kaist-grey">
          {summary}
        </p>
        <div className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold tracking-tight text-kaist-greygreen">
          <CalendarDays className="h-3 w-3"/>
          {date}
        </div>
      </div>
    </Link>);
}
export function EventCarousel() {
    const carouselRef = useRef<HTMLDivElement>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(1);
    const [pageWidth, setPageWidth] = useState(0);
    const [events, setEvents] = useState<EventCardProps[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const totalPages = Math.ceil(events.length / itemsPerPage);
    const pageGap = 24;
    useEffect(() => {
        let active = true;
        const now = Date.now();
        getUpcomingEvents(now)
            .then((response) => {
            if (!active)
                return;
            setEvents(response.items.map((event) => toEventCard(event, now)));
            setLoadState('ready');
        })
            .catch(() => {
            if (active)
                setLoadState('error');
        });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        const carousel = carouselRef.current;
        if (!carousel)
            return;
        const updateItemsPerPage = () => {
            const width = carousel.getBoundingClientRect().width;
            const sideGutter = width >= 768 ? 16 : 8;
            const availableWidth = Math.max(0, width - sideGutter * 2);
            const visibleCards = availableWidth >= 760 ? 4 : availableWidth >= 560 ? 3 : availableWidth >= 380 ? 2 : 1;
            setPageWidth(width);
            setItemsPerPage(visibleCards);
        };
        updateItemsPerPage();
        const observer = new ResizeObserver(updateItemsPerPage);
        observer.observe(carousel);
        return () => observer.disconnect();
    }, [loadState]);
    useEffect(() => {
        setCurrentPage((page) => Math.min(page, Math.max(0, totalPages - 1)));
    }, [totalPages]);
    const handlePrevPage = () => {
        setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
    };
    const handleNextPage = () => {
        setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
    };
    const statusMessage = useMemo(() => {
        if (loadState === 'loading')
            return uiText("components.organisms.event-carousel.60d4e3c354");
        if (loadState === 'error')
            return uiText("components.organisms.event-carousel.95bbcb1c71");
        if (events.length === 0)
            return uiText("components.organisms.event-carousel.2168c065a8");
        return null;
    }, [events.length, loadState]);
    return (<section className="h-full overflow-hidden bg-kaist-white">
      <div className="flex h-full w-full flex-col px-5 pt-5 lg:px-10 lg:pt-8">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {statusMessage ? (<p className="text-sm font-semibold tracking-tight text-kaist-grey">{statusMessage}</p>) : (<>
              <button type="button" onClick={handlePrevPage} className={`absolute left-0 z-10 text-kaist-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] filter transition-transform hover:scale-110 ${currentPage === 0 ? 'pointer-events-none opacity-0' : ''}`} aria-label="Previous page">
                <ChevronLeft className="mb-2 ml-1 h-9 w-9 stroke-[2.5] md:h-11 md:w-11"/>
              </button>

              <div ref={carouselRef} className="h-full w-full overflow-hidden py-3">
                <div className="flex h-full transition-transform duration-500 ease-in-out" style={{
                gap: pageGap,
                transform: `translateX(-${currentPage * (pageWidth + pageGap)}px)`,
            }}>
                  {Array.from({ length: totalPages }).map((_, pageIndex) => (<div key={pageIndex} className="grid h-full flex-shrink-0 items-stretch gap-3 px-1 md:gap-4 md:px-2" style={{
                    gridTemplateColumns: `repeat(${itemsPerPage}, minmax(0, 1fr))`,
                    width: pageWidth ? `${pageWidth}px` : '100%',
                }}>
                      {events.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage).map((event) => (<EventCard key={event.id} {...event}/>))}
                    </div>))}
                </div>
              </div>

              <button type="button" onClick={handleNextPage} className={`absolute right-0 z-10 text-kaist-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] filter transition-transform hover:scale-110 ${currentPage === totalPages - 1 ? 'pointer-events-none opacity-0' : ''}`} aria-label="Next page">
                <ChevronRight className="mb-2 mr-1 h-9 w-9 stroke-[2.5] md:h-11 md:w-11"/>
              </button>
            </>)}
        </div>

        {!statusMessage ? (<div className="mb-4 mt-4 flex flex-shrink-0 items-center justify-center gap-2.5 md:gap-3 lg:mb-5 lg:mt-5">
            {Array.from({ length: totalPages }).map((_, i) => (<button key={i} type="button" onClick={() => setCurrentPage(i)} className={`rounded-full transition-all ${i === currentPage
                    ? 'h-3.5 w-3.5 bg-kaist-darkgreen md:h-4 md:w-4'
                    : 'h-3 w-3 bg-kaist-greygreen hover:bg-kaist-lightgreen2'}`} aria-label={`Go to page ${i + 1}`}/>))}
          </div>) : null}
      </div>
    </section>);
}
