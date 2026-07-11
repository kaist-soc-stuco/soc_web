import { Link, useParams } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { mockEvents } from '@/lib/mock-data';

export function EventSurveyPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const event = mockEvents.find((item) => item.id === Number(eventId)) ?? mockEvents[0];

  return (
    <SiteLayout>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-[36px] font-extrabold tracking-tight text-white">설문조사</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">카이스트 전산학부의 다양한 소식을 알려 드립니다</p>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <h2 className="text-[32px] font-extrabold tracking-tight text-kaist-black">설문 제목이 들어가는 곳입니다</h2>

        <div className="mt-6 overflow-hidden rounded-[15px] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
          <div className="w-[123px] rounded-tr-[15px] bg-kaist-darkgreen-main px-4 py-2 text-[18px] font-semibold text-white">1 중 1 섹션</div>
          <div className="h-[10px] bg-kaist-darkgreen-main" />
          <div className="px-6 py-6">
            <h3 className="text-[32px] font-semibold text-kaist-black">설문 제목(32pt)</h3>
            <p className="mt-3 text-[20px] font-semibold text-kaist-black/85">세부 내용(20pt)</p>
          </div>
        </div>

        <div className="mt-14 space-y-10">
          <section className="rounded-[15px] bg-white p-8 shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
            <h4 className="text-[28px] font-semibold tracking-tight text-kaist-black">블록 제목(28pt)</h4>
            <p className="mt-4 text-[20px] font-semibold text-[#9AA69F]">단답형 텍스트 입력란(20pt)</p>
            <div className="mt-2 max-w-[660px] border-b border-kaist-grey/60" />
          </section>

          <section className="rounded-[15px] bg-white p-8 shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
            <h4 className="text-[28px] font-semibold tracking-tight text-kaist-black">블록 제목(28pt)</h4>
            <div className="mt-6 grid grid-cols-[170px_repeat(5,minmax(0,1fr))] gap-y-8 text-[20px] font-semibold text-kaist-black">
              <div />
              <div>선택지 1</div>
              <div>선택지 2</div>
              <div>선택지 3</div>
              <div>선택지 4</div>
              <div>선택지 5</div>
              {['항목 A', '항목 B', '항목 C'].map((label) => (
                <>
                  <div key={`${label}-label`}>{label}</div>
                  {[1, 2, 3, 4, 5].map((index) => (
                    <label key={`${label}-${index}`} className="flex items-center justify-center">
                      <input type="radio" name={label} className="h-5 w-5 accent-kaist-darkgreen-main" />
                    </label>
                  ))}
                </>
              ))}
            </div>
          </section>

          <section className="rounded-[15px] bg-white p-8 shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
            <h4 className="text-[28px] font-semibold tracking-tight text-kaist-black">블록 제목(28pt)</h4>
            <div className="mt-6 space-y-6">
              {['항목 A', '항목 B'].map((label) => (
                <label key={label} className="flex items-center gap-6 text-[20px] font-semibold text-kaist-black">
                  <input type="checkbox" className="h-5 w-5 accent-kaist-darkgreen-main" />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between">
            <Link
              to="/events"
              className="rounded-[5px] border border-kaist-grey/20 px-5 py-3 text-sm font-bold text-kaist-grey transition hover:border-kaist-grey hover:text-kaist-black"
            >
              행사 목록으로
            </Link>
            <button className="rounded-[5px] bg-kaist-darkgreen-main px-6 py-3 text-sm font-bold text-white transition hover:bg-kaist-darkgreen">
              응답 제출
            </button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
