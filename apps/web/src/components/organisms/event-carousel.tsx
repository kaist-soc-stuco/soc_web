import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EventCardProps {
  image: string;
  title: string;
  date: string;
  status: 'ongoing' | 'completed';
}

function EventCard({ image, title, date, status }: EventCardProps) {
  return (
    <div className="w-[calc(25%-0.75rem)] flex-shrink-0">
      {/* Image */}
      <div 
        className="aspect-[3/4] w-full rounded-sm bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
      
      {/* Bottom Line */}
      <div className="mt-2 h-px w-full border-t border-kaist-darkgreen" />
      
      {/* Status & Date */}
      <div className="mt-1 flex items-center justify-between">
        <div 
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight text-kaist-white ${
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
      <h3 className="mt-2 text-sm font-extrabold tracking-tight text-kaist-black line-clamp-2">
        {title}
      </h3>
    </div>
  );
}

export function EventCarousel() {
  const [currentPage, setCurrentPage] = useState(0);
  
  // TODO: MySQL에서 이벤트 데이터 가져오기
  const events = [
    { image: '/temp.png', title: '전산학부 간식이벤트 1', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 2', date: '26.04.17', status: 'ongoing' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 3', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 4', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 5', date: '26.04.17', status: 'ongoing' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 6', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 7', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 8', date: '26.04.17', status: 'ongoing' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 9', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 10', date: '26.04.17', status: 'completed' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 11', date: '26.04.17', status: 'ongoing' as const },
    { image: '/temp.png', title: '전산학부 간식이벤트 12', date: '26.04.17', status: 'completed' as const },
  ];

  const itemsPerPage = 4;
  const totalPages = Math.ceil(events.length / itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  return (
    <section className="h-full bg-kaist-white overflow-hidden">
      <div className="h-full w-full px-4 md:px-10 pt-2 flex flex-col">        
        {/* Event Cards with Navigation Arrows */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Left Arrow - positioned at image vertical center */}
          <button
            onClick={handlePrevPage}
            className="absolute left-0 z-10 p-1 md:p-2 text-kaist-darkgreen hover:text-kaist-darkgreen-main transition-colors"
            style={{ top: 'calc(37.5% - 1rem)' }} // 이미지 aspect-[3/4]의 중앙 (전체 카드 높이의 약 37.5%)
            aria-label="Previous page"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>

          {/* Event Cards Container with Slide Animation */}
          <div className="w-full overflow-hidden">
            <div 
              className="flex gap-3 transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentPage * 100}%)`,
              }}
            >
              {Array.from({ length: totalPages }).map((_, pageIndex) => (
                <div key={pageIndex} className="w-full flex-shrink-0 flex justify-center gap-3">
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
            className="absolute right-0 z-10 p-1 md:p-2 text-kaist-darkgreen hover:text-kaist-darkgreen-main transition-colors"
            style={{ top: 'calc(37.5% - 1rem)' }}
            aria-label="Next page"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        </div>

        {/* Carousel Dots */}
        <div className="flex-shrink-0 mt-3 pb-2 flex items-center justify-center gap-2 md:gap-3">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`rounded-full transition-all ${
                i === currentPage 
                  ? 'h-4 w-4 md:h-5 md:w-5 bg-kaist-darkgreen' 
                  : 'h-3 w-3 md:h-[14px] md:w-[14px] bg-kaist-lightgreen hover:bg-kaist-lightgreen2'
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
