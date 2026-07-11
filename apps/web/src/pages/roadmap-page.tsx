import { SiteLayout } from '@/components/organisms/site-layout';
import { roadmapMilestones } from '@/lib/mock-data';

export function RoadmapPage() {
  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-56px)] bg-[#92A38D] px-6 py-10">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-[#c8d5cb] bg-white shadow-[0_20px_70px_rgba(57,64,75,0.12)]">
          <div className="h-4 bg-[linear-gradient(90deg,#006B4A_0%,#8DCDAE_100%)]" />

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-[6px] border border-[#d7e2da] bg-[#fcfdfc] px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-kaist-grey">ROADMAP INDEX</p>
              <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-kaist-black">전산학부 로드맵</h1>
              <div className="mt-6 space-y-3">
                {roadmapMilestones.map((milestone, index) => (
                  <div key={milestone} className="flex items-center gap-3 border-b border-[#e0e9e3] pb-3 last:border-b-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-kaist-darkgreen text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-[13px] font-semibold leading-5 text-kaist-black">{milestone}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[6px] border border-[#d7e2da] bg-white px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['기초 과목', '프로그래밍, 이산수학, 자료구조'],
                  ['핵심 역량', '알고리즘, 시스템, 컴퓨터구조'],
                  ['확장 경험', '프로젝트, 학회, 대회, 학생회'],
                  ['진로 설계', '연구실, 인턴십, 졸업 연구'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[6px] border border-[#d7e2da] bg-[#f8fbf8] p-4">
                    <p className="text-sm font-extrabold tracking-tight text-kaist-darkgreen">{title}</p>
                    <p className="mt-2 text-[12px] font-medium leading-5 text-kaist-grey">{body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[6px] border border-[#d7e2da] bg-[#fcfdfc] p-5">
                <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">학부 생활과 함께 보는 로드맵</h2>
                <p className="mt-3 text-[13px] font-medium leading-6 text-kaist-grey">
                  로드맵은 수업 이수 순서만 의미하지 않습니다. 행사 참여, 학생회 활동, 프로젝트 경험, 연구실 탐색이 함께 쌓일수록
                  전산학부 생활의 밀도가 높아집니다. 이후 단계에서는 이 영역을 실제 학사 정보와 연동해 더 정교하게 확장할 수 있습니다.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
