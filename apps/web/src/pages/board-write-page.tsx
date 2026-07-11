import { useParams, Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { boardInfo } from '@/lib/mock-data';

export function BoardWritePage() {
  const { category = '공지' } = useParams<{ category: string }>();

  return (
    <SiteLayout>
      <div className="bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">{category} 글 작성</h1>
          <p className="mt-2 text-sm font-medium text-white/85">{boardInfo[category]?.description ?? ''}</p>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-[28px] border border-kaist-grey/15 bg-white p-8 shadow-[0_24px_80px_rgba(57,64,75,0.08)]">
          <div className="grid gap-6">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-kaist-black">제목</span>
              <input
                type="text"
                placeholder={`${category} 게시판 제목을 입력하세요`}
                className="rounded-2xl border border-kaist-grey/20 px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-kaist-black">요약</span>
              <input
                type="text"
                placeholder="게시글 한 줄 요약"
                className="rounded-2xl border border-kaist-grey/20 px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-kaist-black">본문</span>
              <textarea
                rows={12}
                placeholder="게시글 내용을 입력하세요"
                className="rounded-3xl border border-kaist-grey/20 px-4 py-4 text-sm outline-none transition focus:border-kaist-darkgreen"
              />
            </label>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Link
              to={`/board/${category}`}
              className="inline-flex items-center rounded-full border border-kaist-grey/20 px-5 py-3 text-sm font-bold text-kaist-grey transition hover:border-kaist-grey hover:text-kaist-black"
            >
              취소
            </Link>
            <button className="inline-flex items-center rounded-full bg-kaist-darkgreen px-5 py-3 text-sm font-bold text-white transition hover:bg-kaist-darkgreen-main">
              등록하기
            </button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
