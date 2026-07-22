import { useParams, Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { boardInfo } from '@/lib/mock-data';

export function BoardWritePage() {
  const { category = '공지' } = useParams<{ category: string }>();
  const pageContainerClass = 'mx-auto w-full px-[12vw]';

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-4.5rem)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-12">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[36px] font-extrabold tracking-tight text-white">{category} 글 작성</h1>
            <p className="text-[24px] font-semibold tracking-tight text-white">{boardInfo[category]?.description ?? ''}</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 py-2`}>
          <div className="border-b-3 border-kaist-darkgreen-main py-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-kaist-black lg:text-[32px]">
              게시글 작성
            </h2>
            <p className="mt-2 text-sm font-semibold tracking-tight text-kaist-grey lg:text-base">
              {category} 게시판에 등록할 내용을 입력하세요.
            </p>
          </div>

          <div className="grid gap-6 py-8 lg:py-10">
            <label className="grid gap-3">
              <span className="text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-lg">제목</span>
              <input
                type="text"
                placeholder={`${category} 게시판 제목을 입력하세요`}
                className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 text-sm font-medium tracking-tight text-kaist-black outline-none transition focus:border-kaist-darkgreen lg:text-base"
              />
            </label>

            <label className="grid gap-3">
              <span className="text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-lg">요약</span>
              <input
                type="text"
                placeholder="게시글 한 줄 요약"
                className="rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-3 text-sm font-medium tracking-tight text-kaist-black outline-none transition focus:border-kaist-darkgreen lg:text-base"
              />
            </label>

            <label className="grid gap-3">
              <span className="text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-lg">본문</span>
              <textarea
                rows={12}
                placeholder="게시글 내용을 입력하세요"
                className="min-h-[320px] rounded-[5px] border border-kaist-grey/30 bg-white px-4 py-4 text-sm font-medium leading-7 tracking-tight text-kaist-black outline-none transition focus:border-kaist-darkgreen lg:text-base lg:leading-8"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-kaist-grey/20 pt-6">
            <Link
              to={`/board/${category}`}
              className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-white"
            >
              취소
            </Link>
            <button className="inline-flex items-center rounded-[5px] border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-2 text-sm font-extrabold tracking-tight text-white transition-colors hover:bg-kaist-darkgreen-main">
              등록하기
            </button>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
