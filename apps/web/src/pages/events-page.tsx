import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { mockEvents } from '@/lib/mock-data';
import { CalendarDays, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';

export function EventsPage() {
  const cardEvents = Array.from({ length: 10 }, (_, index) => ({
    ...mockEvents[index % mockEvents.length],
    id: index + 1,
  }));

  return (
    <SiteLayout>
      <div className="relative h-[145px] overflow-hidden bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)]">
        <img
          src="/kaist_logo.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[clamp(2rem,12vw,13rem)] top-[-30px] hidden w-[380px] rotate-[-13deg] opacity-80 md:block"
        />
        <div className="mx-auto flex h-full max-w-[1646px] flex-col justify-center px-6 xl:px-0">
          <h1 className="text-[36px] font-extrabold tracking-tight text-white">설문조사</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">카이스트 전산학부의 다양한 소식을 알려 드립니다</p>
        </div>
      </div>

      <section className="mx-auto max-w-[1646px] px-6 pb-16 pt-[37px] xl:px-0">
        <div className="mb-[43px] flex h-[35px] items-start justify-end">
          <div className="flex w-[254px] items-center justify-between border-b border-kaist-darkgreen/50 pb-[11px] text-[20px] font-semibold tracking-tight text-[#9AA69F]">
            <span>제목</span>
            <div className="flex items-center gap-8">
              <span className="text-[12px] leading-none text-kaist-darkgreen">⌄</span>
              <Search className="h-[21px] w-[21px] text-kaist-darkgreen" />
            </div>
          </div>
        </div>

        <div className="grid justify-center gap-y-[51px] sm:grid-cols-[repeat(2,270px)] sm:justify-between lg:grid-cols-[repeat(3,270px)] xl:grid-cols-[repeat(5,270px)]">
          {cardEvents.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}/survey`}
              className="group relative h-[359px] w-[270px] overflow-hidden rounded-[15px] bg-[#F7FCFC] shadow-[-1px_0px_4px_rgba(0,0,0,0.25),1px_2px_4px_rgba(0,0,0,0.25)] transition hover:-translate-y-1"
            >
              <div
                className="absolute left-0 top-0 h-[216px] w-[270px] rounded-[2px] bg-cover bg-center"
                style={{ backgroundImage: `url(/event-snack-card.png), url(${event.image})` }}
              >
                <div className="absolute left-[17px] top-[16px] rounded-full bg-[#006B4A] px-[11px] py-[2px] text-[12px] font-semibold leading-[18px] tracking-tight text-white">
                  진행중
                </div>
                <div className="absolute bottom-[10px] left-[17px] rounded-none bg-[#5B93C4] px-[11px] py-[2px] text-[10px] font-semibold leading-[15px] tracking-[0.2em] text-white">
                  KAIST SoC
                </div>
                <div className="absolute bottom-[10px] right-[17px] rounded-[4px] bg-white/90 px-[8px] py-[3px] text-[10px] font-extrabold leading-none text-kaist-black">
                  11/11 (화)
                </div>
              </div>
              <div className="absolute left-[17px] top-[226px]">
                <p className="text-[10px] font-semibold leading-[15px] tracking-tight text-[#5B93C4]">이벤트</p>
                <h2 className="text-[24px] font-extrabold leading-[36px] tracking-tight text-kaist-black">전산학부 간식이벤트</h2>
                <p className="mt-[10px] text-[12px] font-semibold leading-[18px] tracking-tight text-[#98A0AC]">
                  중간고사 기간! SoC 구성원 여러분들을 위해
                  <br />
                  “상무초밥”을 제공해 드립니다. 5/23 9:00 오픈!
                </p>
              </div>
              <p className="absolute bottom-[13px] left-[38px] text-[8px] font-semibold leading-3 tracking-tight text-[#9AA69F]">26.05.23 09:00 구글폼 오픈</p>
              <CalendarDays className="absolute bottom-[14px] left-[19px] h-[9px] w-[9px] text-kaist-black" strokeWidth={2} />
            </Link>
          ))}
        </div>

        <div className="mt-[51px] flex items-center justify-center gap-[25px] text-[18px] font-semibold leading-[27px] tracking-tight text-kaist-black">
          <button type="button" className="grid h-[17px] w-[17px] place-items-center text-kaist-darkgreen" aria-label="이전 페이지">
            <ChevronsLeft className="h-[15px] w-[15px]" strokeWidth={3} />
          </button>
          {Array.from({ length: 10 }, (_, index) => (
            <button
              key={index + 1}
              type="button"
              className={index === 0 ? 'grid size-[33px] place-items-center rounded-[5px] bg-[#1AA172] text-white' : 'min-w-[11px]'}
            >
              {index + 1}
            </button>
          ))}
          <button type="button" className="grid h-[17px] w-[17px] place-items-center text-kaist-darkgreen" aria-label="다음 페이지">
            <ChevronsRight className="h-[15px] w-[15px]" strokeWidth={3} />
          </button>
        </div>
      </section>
    </SiteLayout>
  );
}
