import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Header } from '@/components/organisms/header';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { boardApi } from '@/lib/board-api';
import type { ArticleSummary, Board } from '@soc/contracts';

export function BoardPage() {
  const { category = 'notice' } = useParams<{ category: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pageContainerClass = 'mx-auto w-full px-[12vw]';

  const postsPerPage = 10;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setCurrentPage(1);
    Promise.all([
      boardApi.list({ locale: 'ko' }, controller.signal),
      boardApi.articles(category, { locale: 'ko', limit: 50 }, controller.signal),
    ]).then(([registry, articleList]) => {
      const selected = registry.items.find((item) => item.code === category) ?? null;
      setBoards(registry.items.filter((item) => !item.config.isHidden));
      setBoard(selected);
      setPosts(articleList.items);
      if (!selected) setError(true);
    }).catch((cause: unknown) => {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [category]);

  const filteredPosts = posts.filter((post) => (post.title.value ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
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
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  };


  return (
    <div className="min-h-screen flex flex-col bg-[#F7FCFC]">
      <Header showLogo={true} />
      
      <main className="flex-1 w-full mx-auto">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">
              {board?.title.value ?? category} 게시판
            </h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">
              {board?.description.value ?? ''}
            </p>
          </div>
        </div>

        <div className="bg-[#F7FCFC]">
          <div className="border-b border-kaist-grey/30">
            <div className={`${pageContainerClass} flex flex-wrap items-end justify-between gap-8`}>
              <div className="flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-10">
                {boards.map((item, index) => (
                  <Link key={item.code} to={`/board/${item.code}`} className="relative group" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                    <div className={`relative flex items-center justify-center h-full text-lg font-extrabold tracking-tight transition-colors ${category === item.code ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                      <span className="py-3">{item.title.value}</span>
                      <span className={`absolute bottom-0 left-0 right-0 h-1.5 bg-kaist-darkgreen transition-transform duration-200 origin-center ${category === item.code ? 'scale-x-150' : hoveredIndex === index ? 'scale-x-150' : 'scale-x-0'}`} />
                    </div>
                  </Link>
                ))}
              </div>
              
              <div className="flex items-center">
                <div className="relative flex items-center gap-2 border-b border-kaist-darkgreen/40 mb-2.5">
                  <span className="text-base font-semibold text-[#9AA69F]">제목</span>
                  <span className="text-base text-kaist-darkgreen mb-2">⌄</span>
                  <input
                    type="text"
                    placeholder=""
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-20 bg-transparent text-sm focus:outline-none"
                  />
                  <Search className="h-4 w-4 text-kaist-darkgreen" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${pageContainerClass} pb-16 py-2`}>
          <div className="flex gap-6">
            <div className="flex-[5]">
              <div className="grid grid-cols-12 gap-4 border-b-2 border-kaist-darkgreen-main py-2 pb-3.5 text-sm lg:text-base font-extrabold tracking-tight text-kaist-darkgreen">
                <div className="col-span-1 text-center">번호</div>
                <div className="col-span-1 text-center">분류</div>
                <div className="col-span-7 text-center">제목</div>
                <div className="col-span-1 text-center">글쓴이</div>
                <div className="col-span-1 text-center">작성일</div>
                <div className="col-span-1 text-center">조회</div>
              </div>

              <div className="divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
                {loading ? (
                  <div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">게시글을 불러오는 중입니다</p></div>
                ) : error ? (
                  <div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">게시글을 불러오지 못했습니다</p></div>
                ) : currentPosts.length > 0 ? (
                  currentPosts.map((post) => (
                    <Link key={post.id} to={`/board/${post.boardCode}/${post.id}`} className="grid grid-cols-12 gap-4 py-3.5 hover:bg-kaist-grey/5 transition-colors group">
                      <div className="col-span-1 grid place-content-center text-center text-sm font-medium text-kaist-grey">{post.id}</div>
                      <div className="col-span-1 text-center"><span className="inline-block px-3 py-1 rounded-full bg-kaist-darkgreen text-kaist-white text-xs font-regular tracking-tight">{board?.title.value ?? post.boardCode}</span></div>
                      <div className="col-span-7 flex items-center pl-8 text-left text-sm font-medium tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">{post.title.value}</div>
                      <div className="col-span-1" />
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}</div>
                      <div className="col-span-1" />
                    </Link>
                  ))
                ) : (
                  <div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">게시글이 없습니다</p></div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-center relative">
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`p-1 transition-colors ${
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
                          className={`min-w-[28px] h-[28px] px-2 rounded-[5px] text-[12px] font-medium tracking-tight transition-colors ${
                            currentPage === page
                              ? 'bg-kaist-darkgreen-main text-kaist-white'
                              : 'text-kaist-black hover:bg-kaist-grey/10'
                          }`}
                        >
                          {page}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-2 transition-colors ${
                        currentPage === totalPages
                          ? 'text-kaist-grey/30 cursor-not-allowed'
                          : 'text-kaist-darkgreen hover:bg-kaist-grey/10'
                      }`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <Link
                  to={`/board/${category}/write`}
                  className="absolute right-0 rounded-[5px] border border-kaist-darkgreen bg-white px-4 py-2 text-xs font-semibold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-kaist-white"
                >
                  글쓰기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
