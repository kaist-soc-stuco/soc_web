import { useParams, Link } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { boardInfo } from '@/lib/mock-data';

// TODO: MySQL에서 가져오기
const mockPrevPost = {
  id: 0,
  title: '전산학부 2026년 봄학기 오리엔테이션 안내',
  author: '학생회',
  date: '26.03.03',
  views: 204,
};

const mockNextPost = {
  id: 2,
  title: '3월 학생회 정기 회의 결과 공유',
  author: '학생회',
  date: '26.03.05',
  views: 178,
};

const mockPost = {
  id: 1,
  category: '공지',
  title: '2026년 1학기 전산학부 학생회 활동 안내',
  author: '학생회',
  date: '26.03.04',
  views: 312,
  summary: '2026년 1학기를 맞이하여 전산학부 학생회의 주요 활동 일정과 안내사항을 공지합니다.',
  content: `안녕하세요, 전산학부 학생회입니다.

2026년 1학기를 맞이하여 학생회 활동 계획을 안내드립니다.

주요 일정:
- 3월 10일: 신입생 환영회
- 3월 20일: 학생총회
- 4월 5일: HoC 킥오프 미팅
- 5월 15일: 체육대회

건의사항이나 문의사항은 건의사항 게시판 또는 학생회 이메일로 연락주시기 바랍니다.

감사합니다.`,
  image: '/temp.png',
};

export function BoardPostPage() {
  const { category = '공지', id } = useParams<{ category: string; id: string }>();
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const post = {
    ...mockPost,
    id: Number(id ?? mockPost.id),
    category,
    title: `${category} 게시글 ${id ?? mockPost.id}`,
  };


  return (
    <div className="min-h-screen flex flex-col bg-[#F7FCFC]">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto">
        {/* Banner */}
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">
              {category} 게시판
            </h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">
              {boardInfo[category]?.description || ''}
            </p>
          </div>
        </div>

        {/* Post Content */}
        <div className={`${pageContainerClass} pb-16 py-2`}>

          {/* Post Meta */}
          <div className="flex flex-col gap-5 border-b-2 border-kaist-darkgreen-main py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <span className="mb-3 inline-block w-fit rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold tracking-tight text-kaist-white lg:text-sm">
                {post.category}
              </span>
              <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-kaist-black lg:text-[28px]">
                {post.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm font-medium tracking-tight text-kaist-grey">
                <span className="font-semibold text-kaist-black">{post.author}</span>
                <span className="text-kaist-grey">|</span>
                <span>{post.date}</span>
                <span className="text-kaist-grey">|</span>
                <span>조회 {post.views}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                to={`/board/${category}`}
                className="flex items-center gap-2 rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-kaist-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                글 목록
              </Link>
              <Link
                to={`/board/${category}/write`}
                className="flex items-center gap-2 rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen-main"
              >
                글쓰기
              </Link>
            </div>
          </div>

          {/* Post Body */}
          <div className="py-7 lg:py-8">
            <div className="flow-root">
              <div
                className="mb-6 aspect-[3/4] w-full max-w-[min(100%,340px)] rounded-[5px] bg-cover bg-center md:float-left md:mb-6 md:mr-[clamp(2rem,3vw,3rem)] md:w-[clamp(240px,24vw,340px)]"
                style={{ backgroundImage: `url(${post.image})` }}
              />

              <h3 className="mb-3 text-xl font-extrabold tracking-tight text-kaist-black lg:text-[22px]">
                {post.title}
              </h3>
              <p className="mb-6 text-sm font-medium leading-relaxed tracking-tight text-kaist-grey">
                {post.summary}
              </p>

              <div className="whitespace-pre-line text-sm font-medium leading-7 tracking-tight text-kaist-black">
                {post.content}
              </div>
            </div>
          </div>

          {/* Prev / Next Navigation */}
          <div>
            <Link
              to={`/board/${category}/${mockPrevPost.id}`}
              className="group flex items-center gap-4 border-t border-b border-kaist-grey/30 py-4 transition-colors hover:bg-kaist-grey/5"
            >
              <ChevronUp className="h-4 w-4 shrink-0 text-kaist-darkgreen-main" />
              <span className="w-10 shrink-0 text-xs font-semibold text-kaist-grey">이전글</span>
              <span className="flex-1 truncate text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen lg:text-base">
                {mockPrevPost.title}
              </span>
              <div className="hidden shrink-0 items-center gap-3 text-xs font-medium text-kaist-grey md:flex">
                <span>{mockPrevPost.author}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>{mockPrevPost.date}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>조회 {mockPrevPost.views}</span>
              </div>
            </Link>
            <Link
              to={`/board/${category}/${mockNextPost.id}`}
              className="group flex items-center gap-4 border-b border-kaist-grey/30 py-4 transition-colors hover:bg-kaist-grey/5"
            >
              <ChevronDown className="h-4 w-4 shrink-0 text-kaist-darkgreen-main" />
              <span className="w-10 shrink-0 text-xs font-semibold text-kaist-grey">다음글</span>
              <span className="flex-1 truncate text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen lg:text-base">
                {mockNextPost.title}
              </span>
              <div className="hidden shrink-0 items-center gap-3 text-xs font-medium text-kaist-grey md:flex">
                <span>{mockNextPost.author}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>{mockNextPost.date}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>조회 {mockNextPost.views}</span>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
