import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Calendar() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 1년 전/후 제한 계산
  const minDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth() + 1, 0);

  // 달력 날짜 생성
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 해당 월의 첫날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 첫날의 요일 (0: 일요일)
    const firstDayOfWeek = firstDay.getDay();
    
    // 날짜 배열 생성
    const days = [];
    
    // 이전 달의 날짜로 채우기
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, event: null, isCurrentMonth: false });
    }
    
    // 현재 달의 날짜
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const isToday = 
        year === today.getFullYear() && 
        month === today.getMonth() && 
        day === today.getDate();
      
      // TODO: MySQL에서 이벤트 데이터 가져오기
      let event = null;
      if (day === 2) {
        event = { title: '정기회의', color: 'bg-kaist-darkgreen' };
      } else if (day === 17) {
        event = { title: '설 연휴', color: 'bg-kaist-brown' };
      }
      
      days.push({ day, event, isCurrentMonth: true, today: isToday });
    }
    
    // 남은 칸을 다음 달 날짜로 채우기 (총 35칸 = 5주)
    const remainingDays = 35 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: null, event: null, isCurrentMonth: false });
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    if (newDate >= minDate) {
      setCurrentDate(newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    if (newDate <= maxDate) {
      setCurrentDate(newDate);
    }
  };

  const canGoPrev = new Date(currentYear, currentMonth - 1, 1) >= minDate;
  const canGoNext = new Date(currentYear, currentMonth + 1, 1) <= maxDate;

  const days = generateCalendarDays();

  return (
    <section className="h-full bg-kaist-white flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden border-b border-kaist-grey/30">
        {/* Header */}
        <div className="mb-2 mt-1 flex-shrink-0 relative flex items-center justify-center">
          {/* Arrow - Year/Month - Arrow Group (centered) */}
          <div className="flex items-center gap-4">
            {/* Left Arrow */}
            <button 
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className={`text-kaist-darkgreen hover:text-kaist-darkgreen-main transition-colors ${
                !canGoPrev ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Year and Month */}
            <h3 className="text-base md:text-lg font-extrabold tracking-tight text-kaist-darkgreen">
              {currentYear}년 {currentMonth + 1}월
            </h3>

            {/* Right Arrow */}
            <button 
              onClick={handleNextMonth}
              disabled={!canGoNext}
              className={`text-kaist-darkgreen hover:text-kaist-darkgreen-main transition-colors ${
                !canGoNext ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Plus Button (absolute right) */}
          <button className="absolute right-0 text-base md:text-lg font-extrabold tracking-tight text-kaist-greygreen hover:text-kaist-darkgreen transition-colors">
            +
          </button>
        </div>

        {/* Divider */}
        <div className="mb-2 h-0.5 w-full bg-kaist-grey/30 flex-shrink-0" />

        {/* Weekday Headers */}
        <div className="mb-3 grid grid-cols-7 gap-x-2 flex-shrink-0">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div key={index} className="text-center">
              <span className="text-xs font-semibold tracking-tight text-kaist-grey">
                {day}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-x-2 gap-y-1 overflow-y-auto">
          {days.map((item, index) => (
            <div key={index} className="relative flex flex-col items-center h-full">
              {item.day && (
                <>
                  <span
                    className={`text-sm tracking-tight ${
                      item.today 
                        ? 'font-semibold text-kaist-darkgreen' 
                        : item.isCurrentMonth
                        ? 'font-normal text-kaist-greygreen'
                        : 'font-normal text-kaist-grey/30'
                    }`}
                  >
                    {item.day}
                  </span>
                  {/* 이벤트 영역 - 항상 공간 확보 */}
                  <div className="mt-1 h-3 w-full max-w-[28px]">
                    {item.event && (
                      <div
                        className={`h-full rounded-full ${item.event.color} flex items-center justify-center`}
                      >
                        <span className="text-[6px] font-normal tracking-tight text-kaist-white truncate px-1">
                          {item.event.title}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
