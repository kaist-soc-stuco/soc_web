import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { mockEvents } from '@/lib/mock-data';
import { Search } from 'lucide-react';

export function EventsPage() {
  const cardEvents = Array.from({ length: 10 }, (_, index) => ({
    ...mockEvents[index % mockEvents.length],
    id: index + 1,
  }));

  return (
    <SiteLayout>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7">
        <div className="mx-auto max-w-[1680px]">
          <h1 className="text-[36px] font-extrabold tracking-tight text-white">설문조사</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">카이스트 전산학부의 다양한 소식을 알려 드립니다</p>
        </div>
      </div>

      <section className="mx-auto max-w-[1680px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-end gap-5">
          <div className="flex items-center gap-2 border-b border-kaist-darkgreen/40 pb-2 text-[20px] font-semibold text-[#9AA69F]">
            <span>제목</span>
            <span className="text-sm">⌄</span>
          </div>
          <div className="flex items-center gap-2 border-b border-kaist-darkgreen/40 pb-2">
            <Search className="h-4 w-4 text-kaist-darkgreen" />
          </div>
        </div>

        <div className="grid gap-x-14 gap-y-12 sm:grid-cols-2 xl:grid-cols-5">
          {cardEvents.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}/survey`}
              className="group overflow-hidden rounded-[15px] border border-kaist-grey/10 bg-white shadow-[-1px_0px_4px_rgba(0,0,0,0.2),1px_2px_4px_rgba(0,0,0,0.2)] transition hover:-translate-y-1"
            >
              <div
                className="relative aspect-[270/216] bg-cover bg-center"
                style={{ backgroundImage: `url(${event.image})` }}
              >
                <div className="absolute left-4 top-4 rounded-full bg-kaist-darkgreen px-3 py-1 text-[12px] font-semibold text-white">
                  진행중
                </div>
                <div className="absolute bottom-4 left-4 rounded-full bg-[#5B93C4] px-3 py-1 text-[10px] font-semibold text-white">
                  KAIST SoC
                </div>
                <div className="absolute bottom-4 right-4 rounded-[4px] bg-white/85 px-2 py-1 text-[10px] font-semibold text-kaist-black">
                  11/11 (화)
                </div>
              </div>
              <div className="px-4 pb-4 pt-3">
                <p className="text-[10px] font-semibold tracking-tight text-[#5B93C4]">이벤트</p>
                <h2 className="mt-1 text-[24px] font-extrabold tracking-tight text-kaist-black">전산학부 간식이벤트</h2>
                <p className="mt-3 text-[12px] font-semibold leading-5 text-kaist-grey">
                  중간고사 기간! SoC 구성원 여러분들을 위해
                  <br />
                  “상무초밥”을 제공해 드립니다. 5/23 9:00 오픈!
                </p>
                <p className="mt-3 text-[8px] font-semibold text-[#9AA69F]">26.05.23 09:00 구글폼 오픈</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-center gap-5 text-[18px] font-semibold text-kaist-black">
          <button type="button" className="text-kaist-darkgreen">◀</button>
          {Array.from({ length: 10 }, (_, index) => (
            <button
              key={index + 1}
              type="button"
              className={index === 0 ? 'rounded-[5px] bg-kaist-darkgreen-main px-3 py-1 text-white' : ''}
            >
              {index + 1}
            </button>
          ))}
          <button type="button" className="text-kaist-darkgreen">▶</button>
        </div>
      </section>
    </SiteLayout>
  );
}
