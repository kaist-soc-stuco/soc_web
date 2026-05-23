import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createApiClient } from '@soc/api-client';
import { resolveApiBaseUrl } from '@/lib/api';

interface EventCardProps {
  id: string;
  image: string;
  title: string;
  date: string;
  status: 'ongoing' | 'completed';
}

function EventCard({ id, image, title, date, status }: EventCardProps) {
  const isMock = id.startsWith('mock-');
  const cardContent = (
    <div className="w-full flex-shrink-0 select-none">
      {/* Image */}
      <div 
        className="aspect-[3/4] w-full rounded-2xl bg-cover bg-center border border-kaist-grey/15 shadow-sm group-hover:shadow-md transition-all duration-300"
        style={{ backgroundImage: `url(${image})` }}
      />
      {/* Status & Date */}
      <div className="mt-3 flex items-center justify-between">
        <div 
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight text-kaist-white ${
            status === 'ongoing' 
              ? 'bg-kaist-lightgreen2' 
              : 'bg-kaist-darkgreen'
          }`}
        >
          {status === 'ongoing' ? '진행중' : '완료'}
        </div>
        <span className="text-xs font-semibold tracking-tight text-kaist-grey">
          {date}
        </span>
      </div>
      
      {/* Title */}
      <h3 className="mt-2 text-base font-extrabold tracking-tight text-kaist-black line-clamp-2 group-hover:text-kaist-darkgreen transition-colors">
        {title}
      </h3>
    </div>
  );

  if (isMock) {
    return (
      <div className="w-[calc(25%-1.75rem)] flex-shrink-0 group">
        {cardContent}
      </div>
    );
  }

  return (
    <Link to={`/board/행사/${id}`} className="w-[calc(25%-1.75rem)] flex-shrink-0 group block">
      {cardContent}
    </Link>
  );
}

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export function EventCarousel() {
  const [currentPage, setCurrentPage] = useState(0);
  const [events, setEvents] = useState<EventCardProps[]>([]);
  const [loading, setLoading] = useState(true);

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const res = await apiClient.getArticles("행사", { limit: 12 });
        const detailedEvents = await Promise.all(
          res.items.map(async (item) => {
            try {
              const detail = await apiClient.getArticle("행사", item.articleId);
              const imgAsset = detail.assets?.find(
                (a) => a.usageType === "THUMBNAIL" || a.usageType === "IMAGE"
              );
              
              let status: "ongoing" | "completed" = "completed";
              if (detail.survey) {
                status = detail.survey.computedState === "open" ? "ongoing" : "completed";
              } else {
                const isRecent = new Date(item.postedAt).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000;
                status = isRecent ? "ongoing" : "completed";
              }

              return {
                id: item.articleId,
                title: item.titleKo,
                date: formatDate(item.postedAt),
                image: imgAsset ? imgAsset.storageKey : "/temp.png",
                status,
              };
            } catch {
              return {
                id: item.articleId,
                title: item.titleKo,
                date: formatDate(item.postedAt),
                image: "/temp.png",
                status: "completed" as const,
              };
            }
          })
        );
        if (active) {
          setEvents(detailedEvents);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setEvents([]);
          setLoading(false);
        }
      }
    };

    void loadEvents();
    return () => {
      active = false;
    };
  }, [apiClient]);

  // Fallback data to display if DB returns no event posts, maintaining high aesthetic standards
  const displayEvents = events.length > 0 ? events : [
    { id: 'mock-1', image: '/temp.png', title: '전산학부 간식이벤트 1 (예시)', date: '26.04.17', status: 'completed' as const },
    { id: 'mock-2', image: '/temp.png', title: '전산학부 간식이벤트 2 (예시)', date: '26.04.17', status: 'ongoing' as const },
    { id: 'mock-3', image: '/temp.png', title: '전산학부 간식이벤트 3 (예시)', date: '26.04.17', status: 'completed' as const },
    { id: 'mock-4', image: '/temp.png', title: '전산학부 간식이벤트 4 (예시)', date: '26.04.17', status: 'completed' as const },
    { id: 'mock-5', image: '/temp.png', title: '전산학부 간식이벤트 5 (예시)', date: '26.04.17', status: 'ongoing' as const },
    { id: 'mock-6', image: '/temp.png', title: '전산학부 간식이벤트 6 (예시)', date: '26.04.17', status: 'completed' as const },
  ];

  const itemsPerPage = 4;
  const totalPages = Math.ceil(displayEvents.length / itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  if (loading) {
    return (
      <section className="h-full bg-kaist-white overflow-hidden flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kaist-darkgreen"></div>
      </section>
    );
  }

  return (
    <section className="h-full bg-kaist-white overflow-hidden">
      <div className="h-full w-full px-4 md:px-4 pt-8 flex flex-col">        
        {/* Event Cards with Navigation Arrows */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Left Arrow */}
          <button
            onClick={handlePrevPage}
            className={`absolute left-0 z-10 text-kaist-darkgreen hover:text-kaist-darkgreen/80 transition-colors border-0 bg-transparent cursor-pointer ${
              currentPage === 0 ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{ top: 'calc(37.5% - 1rem)' }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>

          {/* Event Cards Container with Slide Animation */}
          <div className="w-full overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentPage * 100}%)`,
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIndex) => (
                <div key={pageIndex} className="w-full flex-shrink-0 flex justify-center gap-3">
                  {displayEvents.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage).map((event) => (
                    <EventCard key={event.id} {...event} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right Arrow */}
          <button
            onClick={handleNextPage}
            className={`absolute right-0 z-10 text-kaist-darkgreen hover:text-kaist-darkgreen/80 transition-colors border-0 bg-transparent cursor-pointer ${
              currentPage === totalPages - 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{ top: 'calc(37.5% - 1rem)' }}
            aria-label="Next page"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        </div>

        {/* Carousel Dots */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 mt-6 mb-2 flex items-center justify-center gap-2 md:gap-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`rounded-full transition-all border-0 cursor-pointer ${
                  i === currentPage 
                    ? 'h-4 w-4 md:h-4 md:w-4 bg-kaist-darkgreen' 
                    : 'h-3 w-3 md:h-3 md:w-3 bg-kaist-lightgreen hover:bg-kaist-lightgreen2'
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
