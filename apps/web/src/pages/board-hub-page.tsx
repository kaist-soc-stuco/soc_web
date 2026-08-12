import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BoardListResponse } from '@soc/contracts';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Header } from '@/components/organisms/header';
import { boardApi } from '@/lib/board-api';
import { localizedText } from '@/lib/localized-content';
import { useLocale } from '@/lib/locale-store';

export function BoardHubPage() {
    const [locale] = useLocale();
    const [boards, setBoards] = useState<BoardListResponse['items']>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageContainerClass = 'mx-auto max-w-[1600px]';
    const postsPerPage = 10;

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError(false);
        boardApi.list({ locale, home: true, latestLimit: 5 }, controller.signal)
            .then(({ items }) => {
            if (active)
                setBoards(items.filter((board) => !board.config.isHidden));
        })
            .catch((cause: unknown) => {
            if (active && !(cause instanceof DOMException && cause.name === 'AbortError'))
                setError(true);
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; controller.abort(); };
    }, [locale]);

    const latestArticles = boards.flatMap((board) => (board.latestArticles ?? []).map((article) => ({ board, article })));
    const filteredArticles = latestArticles.filter(({ article }) => localizedText(article.title).toLowerCase().includes(searchQuery.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filteredArticles.length / postsPerPage));
    const currentArticles = filteredArticles.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);
    const pageGroupSize = 10;
    const pageGroupStart = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1;
    const pageGroupEnd = Math.min(totalPages, pageGroupStart + pageGroupSize - 1);
    const pageNumbers = Array.from({ length: pageGroupEnd - pageGroupStart + 1 }, (_, index) => pageGroupStart + index);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return <div className="min-h-screen flex flex-col bg-[#F7FCFC]">
      <Header showLogo={true}/>
      <main className="flex-1 w-full mx-auto">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
          <div className={pageContainerClass}>
            <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-kaist-white">{uiText("pages.board-hub-page.bd1011dee4")}</h1>
            <p className="text-[24px] font-semibold tracking-tight text-kaist-white">{uiText("pages.board-hub-page.760ac028ce")}</p>
          </div>
        </div>

        <div className="bg-[#F7FCFC]">
          <div className="border-b border-kaist-grey/30">
            <div className={`${pageContainerClass} flex flex-wrap items-end justify-between gap-8`}>
              <div className="flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-12">
                {boards.map((board, index) => <Link key={board.id} to={`/board/${board.code}`} className="relative group" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                  <div className="relative flex h-full items-center justify-center text-[20px] font-bold tracking-tight text-kaist-greygreen transition-colors hover:text-kaist-darkgreen">
                    <span className="py-4">{localizedText(board.title)}</span>
                    <span className={`absolute bottom-0 left-0 right-0 h-1 origin-center bg-kaist-darkgreen transition-transform duration-200 ${hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`}/>
                  </div>
                </Link>)}
              </div>

              <div className="flex items-center">
                <div className="relative mb-4 flex items-center gap-2 border-b border-kaist-darkgreen/40">
                  <span className="text-[16px] font-semibold text-[#9AA69F]">{uiText("pages.board-page.078b3a1b0a")}</span>
                  <span className="mb-2 text-base text-kaist-darkgreen">⌄</span>
                  <input type="text" placeholder="" value={searchQuery} onChange={(event) => handleSearchChange(event.target.value)} className="w-20 bg-transparent text-sm focus:outline-none"/>
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
                {loading ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-hub-page.7c8f6585ab")}</p></div>) : error ? (<div className="py-20 text-center text-kaist-grey"><p role="alert" className="text-base font-semibold">{uiText("pages.board-hub-page.478d00882a")}</p></div>) : boards.length === 0 ? (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-hub-page.491c2f6c70")}</p></div>) : currentArticles.length > 0 ? (currentArticles.map(({ board, article }) => <Link key={article.id} to={`/board/${board.code}/${article.id}`} className="grid grid-cols-12 gap-4 py-4 lg:py-5 hover:bg-kaist-grey/5 transition-colors group">
                  <div className="col-span-1 grid place-content-center text-center text-sm font-semibold text-kaist-grey">{article.publicNo}</div>
                  <div className="col-span-1 text-center"><span className="inline-block rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-semibold tracking-tight text-kaist-white">{localizedText(board.title)}</span></div>
                  <div className="col-span-7 flex items-center truncate pl-8 text-left text-sm font-semibold tracking-tight text-kaist-black group-hover:text-kaist-darkgreen">{localizedText(article.title)}</div>
                  <div className="col-span-1"/>
                  <div className="col-span-1 grid place-content-center text-center text-xs font-medium tracking-tight text-kaist-grey">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('ko-KR') : ''}</div>
                  <div className="col-span-1"/>
                </Link>)) : (<div className="py-20 text-center text-kaist-grey"><p className="text-base font-semibold">{uiText("pages.board-hub-page.6c484281b4")}</p></div>)}
              </div>

              <div className="mt-8 lg:mt-16 flex items-center justify-center relative">
                {totalPages > 1 && (<div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`p-1 transition-colors ${currentPage === 1 ? 'text-kaist-grey/30 cursor-not-allowed' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
                    <ChevronLeft className="h-5 w-5"/>
                  </button>
                  {pageNumbers.map((page) => <button key={page} onClick={() => handlePageChange(page)} className={`h-[33px] min-w-[33px] rounded-[5px] px-3 text-[18px] font-semibold tracking-tight transition-colors ${currentPage === page ? 'bg-kaist-darkgreen-main text-kaist-white' : 'text-kaist-black hover:bg-kaist-grey/10'}`}>
                    {page}
                  </button>)}
                  <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`p-2 transition-colors ${currentPage === totalPages ? 'text-kaist-grey/30 cursor-not-allowed' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
                    <ChevronRight className="h-5 w-5"/>
                  </button>
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
}
