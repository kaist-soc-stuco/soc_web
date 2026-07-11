import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { faqPreviewItems } from '@/lib/mock-data';

export function AboutPage() {
  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-56px)] bg-[#92A38D] px-6 py-10">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-[#c8d5cb] bg-white shadow-[0_20px_70px_rgba(57,64,75,0.12)]">
          <div className="h-4 bg-[linear-gradient(90deg,#006B4A_0%,#8DCDAE_100%)]" />
          <div className="border-b border-[#d8e3db] px-8 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-kaist-grey">ABOUT</p>
            <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-kaist-black">전산학부 소개</h1>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.7fr_0.9fr]">
            <section className="rounded-[6px] border border-[#d7e2da] bg-[#fcfdfc] px-6 py-6">
              <div className="max-w-3xl space-y-5 text-[14px] font-medium leading-7 text-[#3d4a45]">
                <p className="text-[18px] font-extrabold leading-8 text-kaist-black">
                  KAIST 전산학부는 컴퓨터과학의 깊이 있는 기초와 빠르게 변하는 최신 기술을 함께 다루는 학문 공동체입니다.
                </p>
                <p>
                  학생들은 프로그래밍, 알고리즘, 시스템, 인공지능, 이론, 인터랙션 등 다양한 분야를 넘나들며 자신만의 관심사를 발전시킬 수 있습니다.
                  수업과 연구실, 프로젝트, 학생회 활동이 서로 자연스럽게 연결되도록 학부 생태계가 구성되어 있습니다.
                </p>
                <p>
                  이 페이지는 전산학부를 처음 접하는 학생이 전체 그림을 빠르게 이해할 수 있도록 만드는 소개 화면입니다. 이후에는 학년별 로드맵,
                  연구실 탐색, 학생 단체, 학사 정보 페이지로 자연스럽게 이어지도록 확장할 수 있습니다.
                </p>
                <p>
                  현재는 프론트 구조를 우선 세팅하는 단계라 실제 소개 문구는 더미로 넣어두었고, 레이아웃은 Figma의 카드형 구성에 맞춰 배치했습니다.
                </p>
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <section className="rounded-[6px] border border-[#d7e2da] bg-white px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">FAQ</h2>
                  <Link to="/board/QnA" className="text-xs font-bold text-kaist-darkgreen">
                    Q&A 게시판
                  </Link>
                </div>

                <div className="space-y-3">
                  {faqPreviewItems.map((item, index) => (
                    <Link
                      key={item.question}
                      to="/board/QnA"
                      className="block border-b border-[#dfe8e2] pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-[13px] font-extrabold tracking-tight text-kaist-darkgreen">
                        {index + 1}. {item.question}
                      </p>
                      <p className="mt-1 text-[12px] font-medium leading-5 text-kaist-grey">{item.answer}</p>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-[6px] border border-[#d7e2da] bg-[#f8fbf8] px-5 py-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-kaist-grey">ROADMAP</p>
                <h2 className="mt-2 text-[18px] font-extrabold tracking-tight text-kaist-black">학년별 로드맵 보기</h2>
                <p className="mt-3 text-[12px] font-medium leading-5 text-kaist-grey">
                  전공 기초부터 연구, 프로젝트, 진로 설계까지 흐름을 확인할 수 있도록 정리한 페이지로 이동합니다.
                </p>
                <Link
                  to="/about/roadmap"
                  className="mt-5 inline-flex items-center rounded-[4px] bg-kaist-darkgreen px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-kaist-darkgreen-main"
                >
                  로드맵 바로가기
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
