import { uiText } from "@/lib/i18n/surface-catalog";
import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/organisms/header';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { boardApi } from '@/lib/board-api';
import type { ArticleSummary, Board } from '@soc/contracts';
import { useLocale } from '@/lib/locale-store';
import { useAuthSession } from '@/lib/auth-session';
import { useAdminGrants } from '@/lib/admin-grants';
import { canCreateBoardArticle } from '@/lib/board-capabilities';
export function BoardPage() {
    const [locale] = useLocale();
    const auth = useAuthSession();
    const grants = useAdminGrants();
    const { category = 'soc-notice' } = useParams<{
        category: string;
    }>();
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [cursorHistory, setCursorHistory] = useState<string[]>(['']);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [boards, setBoards] = useState<Board[]>([]);
    const [board, setBoard] = useState<Board | null>(null);
    const [posts, setPosts] = useState<ArticleSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const pageContainerClass = 'mx-auto max-w-[1600px]';
    const requestId = useRef(0);
    const canCreate = canCreateBoardArticle(board, auth, grants.grants);
    const paginationGroupSize = 10;
    useEffect(() => {
        const controller = new AbortController();
        const activeRequest = ++requestId.current;
        setLoading(true);
        setError(false);
        setCurrentPage(1);
        setCursorHistory(['']);
        setNextCursor(null);
        setBoard(null);
        setPosts([]);
        Promise.all([
            boardApi.list({ locale }, controller.signal),
            boardApi.articles(category, { locale, limit: 10 }, controller.signal),
        ]).then(([registry, articleList]) => {
            if (activeRequest !== requestId.current)
                return;
            const selected = registry.items.find((item) => item.code === category) ?? null;
            setBoards(registry.items.filter((item) => !item.config.isHidden));
            setBoard(selected);
            if (!selected) {
                setError(true);
                return;
            }
            setPosts(articleList.items);
            setNextCursor(articleList.nextCursor);
        }).catch((cause: unknown) => {
            if (activeRequest === requestId.current && !(cause instanceof DOMException && cause.name === 'AbortError'))
                setError(true);
        }).finally(() => {
            if (activeRequest === requestId.current)
                setLoading(false);
        });
        return () => controller.abort();
    }, [category, locale]);
    const currentPosts = posts.filter((post) => (post.title.value ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
    const knownPageCount = Math.max(cursorHistory.length, currentPage + (nextCursor ? 1 : 0));
    const paginationGroupStart = Math.floor((currentPage - 1) / paginationGroupSize) * paginationGroupSize + 1;
    const paginationGroupEnd = Math.min(paginationGroupStart + paginationGroupSize - 1, Math.max(knownPageCount, 1));
    const pageNumbers = Array.from({ length: paginationGroupEnd - paginationGroupStart + 1 }, (_, index) => paginationGroupStart + index);
    const handlePageChange = async (page: number) => {
        if (page <= 0 || page === currentPage || page > currentPage + 1 || page > knownPageCount)
            return;
        const cursor = page === currentPage + 1 ? nextCursor : cursorHistory[page - 1];
        if (!cursor && page === currentPage + 1)
            return;
        setLoading(true);
        setError(false);
        try {
            const articleList = await boardApi.articles(category, { locale, limit: 10, cursor: cursor || undefined });
            setPosts(articleList.items);
            setNextCursor(articleList.nextCursor);
            setCursorHistory((history) => page === history.length + 1 ? [...history, cursor!] : history);
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        catch (cause: unknown) {
            if (!(cause instanceof DOMException && cause.name === 'AbortError'))
                setError(true);
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="min-h-screen flex flex-col bg-[#F7FCFC]">
      <Header showLogo={true}/>
      
      <main className="flex-1 w-full mx-auto">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
          <div className={pageContainerClass}>
            <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-kaist-white">
              {board?.title.value ?? category}{uiText("pages.board-page.bd1011dee4")}</h1>
            <p className="text-[24px] font-semibold tracking-tight text-kaist-white">
              {board?.description.value ?? ''}
            </p>
          </div>
        </div>

        <div className="bg-[#F7FCFC]">
          <div className="border-b border-kaist-grey/30">
            <div className={`${pageContainerClass} flex flex-wrap items-end justify-between gap-8`}>
              <div className="flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-12">
                {boards.map((item, index) => (<Link key={item.code} to={`/board/${item.code}`} className="relative group" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                    <div className={`relative flex items-center justify-center h-full text-[20px] font-bold tracking-tight transition-colors ${category === item.code ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                      <span className="py-4">{item.title.value}</span>
                      <span className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${category === item.code ? 'scale-x-100' : hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`}/>
                    </div>
                  </Link>))}
              </div>
              
              <div className="flex items-center">
                <div className="relative flex items-center gap-2 border-b border-kaist-darkgreen/40 mb-2.5">
                  <span className="text-[16px] font-semibold text-[#9AA69F]">{uiText("pages.board-page.078b3a1b0a")}</span>
                  <span className="text-base text-kaist-darkgreen mb-2">⌄</span>
                  <input type="text" placeholder="" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-20 bg-transparent text-sm focus:outline-none"/>
                  <Search className="h-4 w-4 text-kaist-darkgreen"/>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${pageContainerClass} pb-16 pt-10`}>
          <div className="flex gap-6">
            <div className="flex-[5]">
              <div className="grid grid-cols-12 gap-4 border-b-2 border-kaist-darkgreen-main py-4 text-base font-extrabold tracking-tight text-kaist-darkgreen">
                <div className="col-span-1 text-center">{uiText("pages.board-page.0eae1698d1")}</div>
                <div className="col-span-1 text-center">{uiText("pages.board-page.8b1d74f0c2")}</div>
                <div className="col-span-7 text-center">{uiText("pages.board-page.078b3a1b0a")}</div>
                <div className="col-span-1 text-center">{uiText("pages.board-page.f98eb8b9b0")}</div>
                <div className="col-span-1 text-center">{uiText("pages.board-page.2c1aa463b4")}</div>
                <div className="col-span-1 text-center">{uiText("pages.board-page.72d116b0a0")}</div>
              </div>

              <div className="divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
                {loading ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-page.f9cce8afe6")}</p></div>) : error ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-page.dbd1d2a38b")}</p></div>) : currentPosts.length > 0 ? (currentPosts.map((post) => (<Link key={post.id} to={`/board/${post.boardCode}/${post.id}`} className="grid grid-cols-12 gap-4 py-4 lg:py-5 hover:bg-kaist-grey/5 transition-colors group">
                      <div className="col-span-1 grid place-content-center text-center text-sm font-semibold text-kaist-grey">{post.publicNo}</div>
                      <div className="col-span-1 text-center"><span className="inline-block rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold tracking-tight text-kaist-white">{board?.title.value ?? post.boardCode}</span></div>
                      <div className="col-span-7 flex items-center pl-8 text-left text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen truncate">{post.title.value}</div>
                      <div className="col-span-1"/>
                      <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}</div>
                      <div className="col-span-1"/>
                    </Link>))) : (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-page.a396b53cc0")}</p></div>)}
              </div>

              <div className="mt-8 lg:mt-16 flex items-center justify-center relative">
                {(currentPage > 1 || nextCursor || pageNumbers.length > 1) && (<div className="flex items-center gap-2">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className={`p-1 transition-colors ${currentPage === 1 || loading
                ? 'text-kaist-grey/30 cursor-not-allowed'
                : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
                      <ChevronLeft className="h-5 w-5"/>
                    </button>
                    {pageNumbers.map((page) => (<button key={page} onClick={() => handlePageChange(page)} disabled={loading || page === currentPage} className={`h-[33px] min-w-[33px] rounded-[5px] px-3 text-[18px] font-semibold tracking-tight transition-colors ${currentPage === page
                ? 'bg-kaist-darkgreen-main text-kaist-white'
                : 'text-kaist-black hover:bg-kaist-grey/10 disabled:text-kaist-black'}`}>
                        {page}
                      </button>))}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={!nextCursor || loading} className={`p-2 transition-colors ${!nextCursor || loading
                ? 'text-kaist-grey/30 cursor-not-allowed'
                : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
                      <ChevronRight className="h-5 w-5"/>
                    </button>
                  </div>)}
                {canCreate && (<Link to={`/board/${category}/write`} className="absolute right-0 rounded-[5px] border border-kaist-darkgreen bg-white px-6 py-2 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition-colors hover:bg-kaist-darkgreen hover:text-kaist-white">{uiText("pages.board-page.b22f31b432")}</Link>)}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
