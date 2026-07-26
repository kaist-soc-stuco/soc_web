import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockEvents } from '@/lib/mock-data';

interface EventCardProps {
  id: number;
  image: string;
  title: string;
  date: string;
  status: 'ongoing' | 'completed';
  summary: string;
}

function EventCard({ id, image, title, date, status, summary }: EventCardProps) {
  return (
    <Link
      to={`/events/${id}/survey`}
      className="group flex aspect-[270/359] h-auto max-h-full min-h-[240px] w-full min-w-0 flex-col self-center overflow-hidden rounded-lg bg-kaist-white shadow-[-1px_0_4px_rgba(0,0,0,0.18),1px_2px_4px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-md md:min-h-[260px] lg:min-h-0"
    >
      <div className="relative h-[60.2%] flex-shrink-0 overflow-hidden rounded-t-md bg-kaist-greygreen/20">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <span className="absolute left-3 top-3 rounded-full bg-kaist-darkgreen px-2.5 py-1 text-[10px] font-semibold tracking-tight text-kaist-white">
          {status === 'ongoing' ? '진행중' : '완료'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5">
        <span className="mb-1 text-[10px] font-bold tracking-tight text-[#5b93c4]">
          이벤트
        </span>
        <h3 className="truncate text-base font-extrabold tracking-tight text-kaist-black lg:text-xl">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-normal tracking-tight text-kaist-grey">
          {summary}
        </p>
        <div className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold tracking-tight text-kaist-greygreen">
          <CalendarDays className="h-3 w-3" />
          {date}
        </div>
      </div>
    </Link>
  );
}

export function EventCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  
  const events = useMemo(
    () => [...mockEvents, ...mockEvents.map((event) => ({ ...event, id: event.id + 100 }))],
    [],
  );

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const pageGap = 24;

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const updateItemsPerPage = () => {
      const width = carousel.getBoundingClientRect().width;
      const minCardWidth = 170;
      const gap = 20;
      const sideGutter = width >= 768 ? 8 : 4;
      const availableWidth = Math.max(0, width - sideGutter * 2);
      const visibleCards = Math.floor((availableWidth + gap) / (minCardWidth + gap));

      setPageWidth(width);
      setItemsPerPage(Math.max(1, Math.min(4, visibleCards)));
    };

    updateItemsPerPage();

    const observer = new ResizeObserver(updateItemsPerPage);
    observer.observe(carousel);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages - 1));
  }, [totalPages]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  return (
    <section className="h-full overflow-hidden bg-kaist-white">
      <div className="flex h-full w-full flex-col px-5 pt-5 lg:px-10 lg:pt-9">
        {/* Event Cards with Navigation Arrows */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {/* Left Arrow - positioned at image vertical center */}
          <button
            onClick={handlePrevPage}
            className={`absolute left-0 z-10 text-kaist-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] filter transition-transform hover:scale-110 ${
              currentPage === 0 ? 'opacity-0 pointer-events-none' : ''
            }`}
            aria-label="Previous page"
          >
            <ChevronLeft className="ml-1 mb-2 h-9 w-9 stroke-[2.5] md:h-11 md:w-11" />
          </button>

          {/* Event Cards Container with Slide Animation */}
          <div ref={carouselRef} className="h-full w-full overflow-hidden py-2">
            <div 
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{
                gap: pageGap,
                transform: `translateX(-${currentPage * (pageWidth + pageGap)}px)`,
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIndex) => (
                <div
                  key={pageIndex}
                  className="grid h-full flex-shrink-0 items-stretch gap-3 px-1 md:gap-4 md:px-2"
                  style={{
                    gridTemplateColumns: `repeat(${itemsPerPage}, minmax(0, 1fr))`,
                    width: pageWidth ? `${pageWidth}px` : '100%',
                  }}
                >
                  {events.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage).map((event) => (
                    <EventCard key={event.id} {...event} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right Arrow - positioned at image vertical center */}
          <button
            onClick={handleNextPage}
            className={`absolute right-0 z-10 text-kaist-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] filter transition-transform hover:scale-110 ${
              currentPage === totalPages - 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
            aria-label="Next page"
          >
            <ChevronRight className="mr-1 mb-2 h-9 w-9 stroke-[2.5] md:h-11 md:w-11" />
          </button>
        </div>

        {/* Carousel Dots */}
        <div className="mb-4 mt-4 flex flex-shrink-0 items-center justify-center gap-2.5 md:gap-3 lg:mb-5 lg:mt-5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`rounded-full transition-all ${
                i === currentPage 
                  ? 'h-3.5 w-3.5 bg-kaist-darkgreen md:h-4 md:w-4' 
                  : 'h-3 w-3 bg-kaist-greygreen hover:bg-kaist-lightgreen2'
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
