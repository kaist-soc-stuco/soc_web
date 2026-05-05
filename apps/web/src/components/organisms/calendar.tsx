import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { nowMs, msToTimeObj, timeObjToMs, addMs, subtractMs, getDayOfWeek } from '@soc/shared';

export function Calendar() {
  const todayMs = nowMs();
  const todayTime = msToTimeObj(todayMs);

  const [viewMs, setViewMs] = useState<number>(() =>
    timeObjToMs({ ...todayTime, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 })
  );

  const viewTime = msToTimeObj(viewMs);
  const { year: currentYear, month: currentMonth } = viewTime;

  const minMs = timeObjToMs({ ...todayTime, year: todayTime.year - 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });
  const maxMs = timeObjToMs({ ...todayTime, year: todayTime.year + 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });

  const generateCalendarDays = () => {
    const firstDayMs = viewMs;
    const lastDayMs = subtractMs(addMs(firstDayMs, 1, 'month'), 1, 'day');
    const lastDayTime = msToTimeObj(lastDayMs);

    // 첫날의 요일 (0: 일요일)
    const firstDayOfWeek = getDayOfWeek(firstDayMs);

    const days = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, event: null, isCurrentMonth: false });
    }

    for (let day = 1; day <= lastDayTime.day; day++) {
      const isToday =
        currentYear === todayTime.year &&
        currentMonth === todayTime.month &&
        day === todayTime.day;

      // TODO: MySQL에서 이벤트 데이터 가져오기
      let event = null;
      if (day === 2) {
        event = { title: '정기회의', color: 'bg-kaist-darkgreen' };
      } else if (day === 17) {
        event = { title: '설 연휴', color: 'bg-kaist-brown' };
      }

      days.push({ day, event, isCurrentMonth: true, today: isToday });
    }

    const remainingDays = 35 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: null, event: null, isCurrentMonth: false });
    }

    return days;
  };

  const prevMs = subtractMs(viewMs, 1, 'month');
  const nextMs = addMs(viewMs, 1, 'month');
  const canGoPrev = prevMs >= minMs;
  const canGoNext = nextMs <= maxMs;

  const handlePrevMonth = () => {
    if (canGoPrev) setViewMs(prevMs);
  };

  const handleNextMonth = () => {
    if (canGoNext) setViewMs(nextMs);
  };

  const days = generateCalendarDays();

  return (
    <section className="h-full bg-kaist-white flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden border-b border-kaist-grey/30">
        {/* Header */}
        <div className="mb-2 mt-1 flex-shrink-0 relative flex items-center justify-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className={`text-kaist-darkgreen hover:text-kaist-darkgreen-main transition-colors ${
                !canGoPrev ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <h3 className="text-base md:text-lg font-extrabold tracking-tight text-kaist-darkgreen">
              {currentYear}년 {currentMonth}월
            </h3>

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
