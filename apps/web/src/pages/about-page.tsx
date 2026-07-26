import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { faqPreviewItems } from '@/lib/mock-data';

export function AboutPage() {
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const faqItems = faqPreviewItems.slice(0, 3);

  return (
    <SiteLayout>
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-[#F7FCFC] lg:h-[calc(100vh-72px)] lg:overflow-hidden">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">전산학부 소개</h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">카이스트 전산학부란?</p>
          </div>
        </div>

        <div className="flex flex-1 items-center py-7 lg:py-0">
          <div className={`${pageContainerClass} grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,410px)] lg:gap-8 xl:gap-10`}>
            <section className="min-h-[500px] rounded-[8px] border border-kaist-grey/25 bg-white px-6 py-7 sm:px-10 lg:min-h-[520px] lg:px-8 lg:py-8 xl:min-h-[540px] xl:px-9">
              <h2 className="text-[24px] font-extrabold leading-normal tracking-tight text-kaist-darkgreen md:text-[28px] xl:text-[30px]">
                KAIST SoC(School Of Computing)
              </h2>

              <div className="mt-8 space-y-8 text-[15px] font-normal leading-[1.9] tracking-tight text-black md:text-[16px] lg:text-[17px] xl:text-[18px]">
                <p>
                  컴퓨팅은 현대사회의 모든 영역에서 활용되고 있으며, 특히 최근에는 빅데이터와 이를 이용한 소셜 컴퓨팅이 주목을 받고 있듯이,
                  컴퓨팅의 패러다임은 하드웨어로부터 소프트웨어를 거쳐 이제 인간 중심으로 변화 하고 있다. 삶의 질을 향상시키기 위해서는 인간에
                  대한 좀 더 깊은 이해가 필요하다. 이에 카이스트 전산학부에서는 새로운 비전을 가지고 이러한 인간 중심의 컴퓨팅을 위한 세계적인
                  리더쉽을 갖춘 인재의 양성을 목표로 연구와 교육에 주력하고 있다.
                </p>
                <p>
                  카이스트 전산학부는 1972년 국내 최초 전산학과로 설립되었으며, 졸업생들은 국내 전산학 학계와 산업계를 주도할 뿐 아니라 국제
                  학계에서도 다양한 리더쉽을 발휘하고 있다. 현재 총 50여 명의 교수진이 있으며 1,000명 이상의 학부생 500여명의 대학원생, 총
                  1,500명의 학생들이 재학 중이다.
                </p>
                <p>
                  카이스트 전산학부는 확고한 이론적 기반을 바탕으로 미래 사회의 컴퓨팅 패러다임의 변화를 주도하는 인간 중심의 컴퓨팅 연구와
                  교육을 통하여 인류를 위한 컴퓨팅과 정보 서비스 기술의 무한한 가능성을 추구한다.
                </p>
              </div>
            </section>

            <aside className="flex flex-col gap-6">
              <section className="rounded-[8px] border border-kaist-grey/25 bg-white px-7 py-5 lg:min-h-[370px]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <h2 className="text-[24px] font-extrabold leading-normal tracking-tight text-kaist-darkgreen md:text-[28px]">FAQ</h2>
                  <Link
                    to="/faq"
                    className="mt-2 inline-flex items-center justify-center rounded-[5px] border border-kaist-darkgreen px-3 py-1.5 text-[13px] font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white"
                  >
                    FAQ 보기
                  </Link>
                </div>

                <div className="divide-y divide-[#d7e2da]">
                  {faqItems.map((item, index) => (
                    <Link key={`${item.question}-${index}`} to="/faq" className="block py-4 first:pt-2 last:pb-0">
                      <p className="text-[15px] font-semibold leading-normal tracking-tight text-kaist-darkgreen-main md:text-[16px]">
                        Q: {item.question}
                      </p>
                      <p className="mt-2 text-[13px] font-normal leading-normal tracking-tight text-kaist-black md:text-[15px]">
                        A: {item.answer}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-[8px] border border-kaist-grey/25 bg-white px-7 py-6">
                <h2 className="mt-1 text-[22px] font-extrabold leading-normal tracking-tight text-kaist-black md:text-[24px]">
                  전산학부 로드맵
                </h2>
                <p className="mt-4 text-[14px] font-semibold leading-[1.75] tracking-tight text-[#8192a3] md:text-[15px]">
                  전공 기초부터 연구, 프로젝트, 진로 설계까지 흐름을 확인할 수 있도록 정리한 페이지로 이동합니다.
                </p>
                <Link
                  to="/about/roadmap"
                  className="mt-7 inline-flex items-center justify-center rounded-[5px] bg-kaist-darkgreen px-5 py-3 text-[14px] font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen-main"
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
