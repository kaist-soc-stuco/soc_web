export function Calendar() {
  const days = [
    // Week 1
    { day: 1, event: null },
    { day: 2, event: { title: '정기회의', color: 'bg-kaist-darkgreen' } },
    { day: 3, event: null },
    { day: 4, event: null },
    { day: 5, event: null },
    { day: 6, event: null },
    { day: 7, event: null },
    // Week 2
    { day: 8, event: null },
    { day: 9, event: null, today: true },
    { day: 10, event: null },
    { day: 11, event: null },
    { day: 12, event: null },
    { day: 13, event: null },
    { day: 14, event: null },
    // Week 3
    { day: 15, event: null },
    { day: 16, event: null },
    { day: 17, event: { title: '설 연휴', color: 'bg-kaist-brown' } },
    { day: 18, event: null },
    { day: 19, event: null },
    { day: 20, event: null },
    { day: 21, event: null },
    // Week 4
    { day: 22, event: null },
    { day: 23, event: null },
    { day: 24, event: null },
    { day: 25, event: null },
    { day: 26, event: null },
    { day: 27, event: null },
    { day: 28, event: null },
  ];

  return (
    <section className="h-full bg-kaist-white flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="mb-3 flex-shrink-0 flex items-center justify-between">
          <h3 className="text-base md:text-lg font-extrabold tracking-tight text-kaist-darkgreen">
            2026년 2월
          </h3>
          <button className="text-base md:text-lg font-extrabold tracking-tight text-kaist-lightgreen hover:text-kaist-darkgreen transition-colors">
            +
          </button>
        </div>

        {/* Divider */}
        <div className="mb-3 h-0.5 w-full bg-[#DBDDD5] flex-shrink-0" />

        {/* Navigation Arrows */}
        <div className="mb-3 flex-shrink-0 flex items-center justify-between px-2">
        <button className="text-kaist-lightgreen2 hover:text-kaist-darkgreen transition-colors">
          <svg className="h-4 w-4 md:h-5 md:w-5 rotate-180" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button className="text-kaist-lightgreen2 hover:text-kaist-darkgreen transition-colors">
          <svg className="h-4 w-4 md:h-5 md:w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 gap-x-2 gap-y-4 content-start overflow-y-auto">
        {days.map(({ day, event, today }, index) => (
          <div key={index} className="relative flex flex-col items-center">
            <span
              className={`text-sm tracking-tight ${
                today 
                  ? 'font-semibold text-kaist-darkgreen' 
                  : 'font-normal text-kaist-lightgreen'
              }`}
            >
              {day}
            </span>
            {event && (
              <div
                className={`mt-1 h-3 w-full max-w-[28px] rounded-full ${event.color} flex items-center justify-center`}
              >
                <span className="text-[6px] font-normal tracking-tight text-kaist-white truncate px-1">
                  {event.title}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
