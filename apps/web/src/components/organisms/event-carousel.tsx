import { useState } from 'react';
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
      className="group flex h-[292px] w-[min(78vw,270px)] flex-shrink-0 flex-col overflow-hidden rounded-md bg-kaist-white shadow-[-1px_0_4px_rgba(0,0,0,0.22),1px_2px_4px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-md sm:w-[240px] lg:h-[min(33.25dvh,359px)] lg:w-[clamp(210px,21.4%,270px)]"
    >
      <div className="relative h-[60.2%] flex-shrink-0 overflow-hidden rounded-t-md bg-kaist-greygreen/20">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <span className="absolute left-4 top-4 rounded-full bg-kaist-darkgreen px-3 py-1 text-[10px] font-semibold tracking-tight text-kaist-white lg:text-xs">
          {status === 'ongoing' ? '진행중' : '완료'}
        </span>
        <div className="absolute bottom-4 left-4 rounded-full bg-[#5b93c4] px-2 py-0.5 text-[10px] font-semibold tracking-tight text-kaist-white">
          이벤트
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
        <h3 className="truncate text-lg font-extrabold tracking-tight text-kaist-black lg:text-2xl">
          {title}
        </h3>
        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-normal tracking-tight text-kaist-grey">
          {summary}
        </p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-semibold tracking-tight text-kaist-greygreen lg:text-xs">
          <CalendarDays className="h-3.5 w-3.5" />
          {date}
        </div>
      </div>
    </Link>
  );
}

export function EventCarousel() {
  const [currentPage, setCurrentPage] = useState(0);
  
  const events = [...mockEvents, ...mockEvents.map((event) => ({ ...event, id: event.id + 100 }))];

  const itemsPerPage = 4;
  const totalPages = Math.ceil(events.length / itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  return (
    <section className="h-full overflow-hidden bg-kaist-white">
      <div className="flex h-full w-full flex-col px-6 pt-8 md:px-8 lg:px-[5.4%] lg:pt-[3.2dvh]">
        {/* Event Cards with Navigation Arrows */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {/* Left Arrow - positioned at image vertical center */}
          <button
            onClick={handlePrevPage}
            className={`absolute left-0 z-10 text-kaist-white drop-shadow-md transition-colors hover:text-kaist-lightgreen2 lg:text-kaist-darkgreen ${
              currentPage === 0 ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{ top: 'calc(50% - 1rem)' }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>

          {/* Event Cards Container with Slide Animation */}
          <div className="w-full overflow-hidden py-1">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentPage * 100}%)`,
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIndex) => (
                <div key={pageIndex} className="flex w-full flex-shrink-0 justify-center gap-4 lg:gap-[2.06%]">
                  {events.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage).map((event, index) => (
                    <EventCard key={`${pageIndex}-${index}`} {...event} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right Arrow - positioned at image vertical center */}
          <button
            onClick={handleNextPage}
            className={`absolute right-0 z-10 text-kaist-white drop-shadow-md transition-colors hover:text-kaist-lightgreen2 lg:text-kaist-darkgreen ${
              currentPage === totalPages - 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{ top: 'calc(50% - 1rem)' }}
            aria-label="Next page"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        </div>

        {/* Carousel Dots */}
        <div className="mb-5 mt-5 flex flex-shrink-0 items-center justify-center gap-3 md:gap-4 lg:mb-[2.9dvh] lg:mt-[3.7dvh]">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`rounded-full transition-all ${
                i === currentPage 
                  ? 'h-4 w-4 bg-kaist-darkgreen md:h-5 md:w-5' 
                  : 'h-3.5 w-3.5 bg-kaist-greygreen hover:bg-kaist-lightgreen2'
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
