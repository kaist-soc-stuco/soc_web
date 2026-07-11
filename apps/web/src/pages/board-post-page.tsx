import { useParams, Link } from 'react-router-dom';
import { Header } from '@/components/organisms/header';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { boardInfo } from '@/lib/mock-data';

// TODO: MySQL에서 가져오기
const mockPrevPost = {
  id: 0,
  title: '전산학부 2026년 봄학기 오리엔테이션 안내',
  author: '박지수',
  date: '26.03.03',
  views: 204,
};

const mockNextPost = {
  id: 2,
  title: '3월 학생회 정기 회의 결과 공유',
  author: '김민준',
  date: '26.03.05',
  views: 178,
};

const mockPost = {
  id: 1,
  category: '공지',
  title: '2026년 1학기 전산학부 학생회 활동 안내',
  author: '조성원',
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
  const post = {
    ...mockPost,
    id: Number(id ?? mockPost.id),
    category,
    title: `${category} 게시글 ${id ?? mockPost.id}`,
  };


  return (
    <div className="min-h-screen flex flex-col bg-kaist-white">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto">
        {/* Banner */}
        <div className="bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 py-12 px-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl font-extrabold tracking-tight text-kaist-white mb-2">
              {category} 게시판
            </h1>
            <p className="text-base font-medium tracking-tight text-kaist-white/90">
              {boardInfo[category]?.description || ''}
            </p>
          </div>
        </div>

        {/* Post Content */}
        <div className="max-w-7xl mx-auto pb-16">

          {/* Post Meta */}
          <div className="pt-8 pb-4 flex items-start justify-between gap-8">
            <div>
              <span className="inline-block mb-3 px-3 py-1 rounded-full bg-kaist-darkgreen text-kaist-white text-xs font-semibold tracking-tight w-fit">
                {post.category}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-kaist-black mb-2">
                {post.title}
              </h2>
              <div className="flex items-center pt-2 gap-2 text-sm font-medium tracking-tight text-kaist-grey">
                <span className="font-semibold text-kaist-black">{post.author}</span>
                <span className="text-kaist-grey">|</span>
                <span>{post.date}</span>
                <span className="text-kaist-grey">|</span>
                <span>조회 {post.views}</span>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <Link
                to={`/board/${category}`}
                className="flex items-center gap-2 border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-kaist-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                글 목록
              </Link>
              <Link
                to={`/board/${category}/write`}
                className="flex items-center gap-2 border border-kaist-darkgreen bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-white transition-colors hover:bg-kaist-darkgreen-main"
              >
                글쓰기
              </Link>
            </div>
          </div>

          <div className="border-t-2 border-kaist-darkgreen" />

          {/* Post Body */}
          <div className="py-8">
            {/* Poster + Title/Summary */}
            <div className="flex gap-8 mb-8">
              <div
                className="aspect-[3/4] w-48 rounded-[1px] bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${post.image})` }}
              />
              <div className="flex flex-col justify-center">
                <h3 className="text-2xl font-extrabold tracking-tight text-kaist-black mb-3">
                  {post.title}
                </h3>
                <p className="text-base font-medium tracking-tight text-kaist-grey leading-relaxed">
                  {post.summary}
                </p>
              </div>
            </div>

            {/* Detailed Content */}
            <div className="text-sm font-medium tracking-tight text-kaist-black leading-relaxed whitespace-pre-line">
              {post.content}
            </div>
          </div>

          {/* Prev / Next Navigation */}
          <div>
            <Link
              to={`/board/${category}/${mockPrevPost.id}`}
              className="flex items-center gap-4 py-3 border-t border-b border-kaist-grey/30 hover:bg-kaist-grey/5 transition-colors group"
            >
              <ChevronUp className="h-4 w-4 shrink-0 text-kaist-darkgreen-main" />
              <span className="text-xs font-semibold text-kaist-grey w-10 shrink-0">이전글</span>
              <span className="flex-1 text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">
                {mockPrevPost.title}
              </span>
              <div className="flex items-center gap-3 text-xs font-medium text-kaist-grey shrink-0">
                <span>{mockPrevPost.author}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>{mockPrevPost.date}</span>
                <span className="text-kaist-darkgreen-main">|</span>
                <span>조회 {mockPrevPost.views}</span>
              </div>
            </Link>
            <Link
              to={`/board/${category}/${mockNextPost.id}`}
              className="flex items-center gap-4 py-3 border-b border-kaist-grey/30 hover:bg-kaist-grey/5 transition-colors group"
            >
              <ChevronDown className="h-4 w-4 shrink-0 text-kaist-darkgreen-main" />
              <span className="text-xs font-semibold text-kaist-grey w-10 shrink-0">다음글</span>
              <span className="flex-1 text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">
                {mockNextPost.title}
              </span>
              <div className="flex items-center gap-3 text-xs font-medium text-kaist-grey shrink-0">
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
