import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/organisms/header';
import { Footer } from '@/components/organisms/footer';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface BoardPost {
  id: number;
  category: string;
  title: string;
  author: string;
  date: string;
  views: number;
}

interface Event {
  id: number;
  title: string;
  date: string;
  image: string;
}

const BOARDS = ['공지', '행사', 'HoC', '홍보글', '건의사항', '연구실', 'QnA'] as const;
type BoardType = typeof BOARDS[number];

const BOARD_INFO: Record<string, {description: string}> = {
  '공지': { description: '학생회 및 학교의 중요한 공지사항을 확인하세요' },
  '행사': { description: '전산학부의 다양한 행사 정보를 확인하세요' },
  'HoC': { description: 'Hall of Code 프로젝트 및 활동 내역' },
  '홍보글': { description: '학생회 및 학회의 홍보 게시물' },
  '건의사항': { description: '학생들의 의견과 건의사항을 나눠주세요' },
  '연구실': { description: '각 연구실의 소식과 공지사항' },
  'QnA': { description: '궁금한 점을 자유롭게 질문하세요' },
};

export function BoardPage() {
  const { category = '공지' } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const postsPerPage = 10;
  
  // TODO: MySQL에서 게시글 데이터 가져오기
  const mockPosts: BoardPost[] = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    category: category,
    title: `${category} 게시글 제목 ${i + 1}`,
    author: '조성원',
    date: '26.03.04',
    views: Math.floor(Math.random() * 1000),
  }));

  // TODO: MySQL에서 진행중인 행사 가져오기
  const ongoingEvents: Event[] = [
    { id: 1, title: '전산학부 간식 이벤트', date: '03.10', image: '/temp.png' },
    { id: 2, title: 'HoC 프로젝트 발표', date: '03.15', image: '/temp.png' },
    { id: 3, title: '학생회 총회', date: '03.20', image: '/temp.png' },
  ];

  const filteredPosts = mockPosts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const currentPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
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
              {BOARD_INFO[category]?.description || ''}
            </p>
          </div>
        </div>

        {/* Board Tabs */}
        <div className="border-b-2 border-kaist-grey/30 bg-kaist-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-stretch justify-between gap-8">
              <div className="flex flex-wrap items-stretch gap-8">
                {BOARDS.map((board, index) => (
                  <Link
                    key={board}
                    to={`/board/${board}`}
                    className="relative group"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className={`relative flex items-center justify-center h-full text-lg font-extrabold tracking-tight transition-colors ${
                      category === board
                        ? 'text-kaist-darkgreen'
                        : 'text-kaist-greygreen hover:text-kaist-darkgreen'
                    }`}>
                      <span className="py-4">{board}</span>
                      <span 
                        className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                          category === board ? 'scale-x-100' : hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                        }`}
                      />
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* Search */}
              <div className="flex items-center">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-kaist-grey" />
                  <input
                    type="text"
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-72 border-b border-kaist-grey/30 text-sm font-medium tracking-tight focus:outline-none focus:border-kaist-darkgreen transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto pb-16">
          <div className="flex gap-6">
            {/* Board List - 5/6 width */}
            <div className="flex-[5]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 py-4 bg-kaist-white border-b-2 border-kaist-darkgreen-main font-extrabold text-sm tracking-tight text-kaist-darkgreen">
                <div className="col-span-1 text-center">번호</div>
                <div className="col-span-1 text-center">말머리</div>
                <div className="col-span-7 text-center">제목</div>
                <div className="col-span-1 text-center">글쓴이</div>
                <div className="col-span-1 text-center">작성일</div>
                <div className="col-span-1 text-center">조회</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
                {currentPosts.length > 0 ? (
                  currentPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/board/${category}/${post.id}`}
                      className="grid grid-cols-12 gap-4 py-4 hover:bg-kaist-grey/5 transition-colors group"
                    >
                      <div className="col-span-1 grid place-content-center text-center text-sm font-semibold text-kaist-grey">
                        {post.id}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-kaist-darkgreen text-kaist-white text-xs font-semibold tracking-tight">
                          {post.category}
                        </span>
                      </div>
                      <div className="col-span-7 flex ml-8 items-center text-left text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">
                        {post.title}
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-sm font-semibold tracking-tight text-kaist-black">
                        {post.author}
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey">
                        {post.date}
                      </div>
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey">
                        {post.views}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-20 text-center text-kaist-grey">
                    <p className="text-base font-semibold">게시글이 없습니다</p>
                  </div>
                )}
              </div>

              {/* Pagination + Write Button */}
              <div className="mt-8 flex items-center justify-center relative">
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`p-1 rounded-md transition-colors ${
                        currentPage === 1
                          ? 'text-kaist-grey/30 cursor-not-allowed'
                          : 'text-kaist-darkgreen hover:bg-kaist-grey/10'
                      }`}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {getPageNumbers().map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`min-w-[40px] h-10 px-3 rounded-md text-sm font-semibold tracking-tight transition-colors ${
                          currentPage === page
                            ? 'bg-kaist-darkgreen text-kaist-white'
                            : 'text-kaist-greygreen hover:bg-kaist-grey/10'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-md transition-colors ${
                        currentPage === totalPages
                          ? 'text-kaist-grey/30 cursor-not-allowed'
                          : 'text-kaist-darkgreen hover:bg-kaist-grey/10'
                      }`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <button className="absolute right-0 px-6 py-2 bg-kaist-white border-1 border-kaist-darkgreen text-kaist-darkgreen rounded-sm text-sm font-extrabold tracking-tight hover:bg-kaist-darkgreen hover:text-kaist-white transition-colors">
                  글쓰기
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
