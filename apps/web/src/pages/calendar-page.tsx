import { SiteLayout } from '@/components/organisms/site-layout';
import { scheduleItems } from '@/lib/mock-data';

export function CalendarPage() {
  const weeks = [
    ['26', '27', '28', '29', '30', '5월 1일', '2'],
    ['3', '4', '5', '6', '7', '8', '9'],
    ['10', '11', '12', '13', '14', '15', '16'],
    ['17', '18', '19', '20', '21', '22', '23'],
    ['24', '25', '26', '27', '28', '29', '30'],
  ];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-[1760px] px-6 py-10">
        <h1 className="text-[48px] font-extrabold tracking-tight text-kaist-black">전산학부 캘린더</h1>

        <div className="mt-6 flex items-center gap-8 text-[28px] font-semibold text-kaist-black">
          <button type="button" className="text-kaist-darkgreen">◀</button>
          <span>2026년 5월</span>
          <button type="button" className="text-kaist-darkgreen">▶</button>
        </div>

        <div className="mt-10 grid gap-10 xl:grid-cols-[1216px_457px]">
          <section className="overflow-hidden rounded-[5px] border border-kaist-grey/15 bg-white shadow-[0_0_5px_1px_rgba(0,0,0,0.12)]">
            <div className="grid grid-cols-7 px-4 py-3 text-center text-[24px] font-semibold text-[#9AA69F]">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="relative">
              <div className="grid grid-cols-7">
                {weeks.flat().map((day, index) => {
                  const isCurrentMonth = !['26', '27', '28', '29', '30'].includes(day);
                  const isFriday = [5, 12, 19, 26, 33].includes(index);

                  return (
                    <div
                      key={`${day}-${index}`}
                      className="h-[137px] border-r border-t border-kaist-grey/20 p-4 text-right last:border-r-0"
                    >
                      <span className={`text-[24px] font-semibold ${isCurrentMonth ? 'text-kaist-black' : 'text-[#9AA69F]'}`}>
                        {day}
                      </span>
                      {isFriday ? (
                        <div className="mx-auto mt-10 rounded-[10px] bg-kaist-lightgreen2 px-3 py-2 text-left text-[20px] font-semibold text-white">
                          Human of CS 신청기간
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="rounded-[5px] border border-kaist-grey/15 bg-white p-6 shadow-[0_0_5px_1px_rgba(0,0,0,0.12)]">
            <div className="space-y-5">
              {scheduleItems.map((item) => (
                <div key={`${item.date}-${item.title}`} className="rounded-[10px] border border-kaist-grey/10 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[20px] font-extrabold text-kaist-darkgreen">{item.date}</span>
                    <span className="rounded-full bg-kaist-lightgreen2/25 px-3 py-1 text-xs font-bold text-kaist-darkgreen">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-kaist-black">{item.title}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
