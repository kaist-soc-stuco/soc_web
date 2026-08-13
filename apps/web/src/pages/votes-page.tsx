import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { VoteSummary } from '@soc/contracts';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

import { Header } from '@/components/organisms/header';
import { useLocale } from '@/lib/locale-store';
import { voteApi } from '@/lib/governance-api';

const stateLabel: Record<VoteSummary['state'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  OPEN: 'Open',
  CLOSED: 'Closed',
  DISCARDED: 'Discarded',
  RESULTS_PUBLISHED: 'Results published',
  RESULTS_RETIRED: 'Results retired',
};
const voteTabs = [
  { label: (locale: 'ko' | 'en') => (locale === 'ko' ? '투표' : 'Votes'), to: '/votes' },
  { label: (locale: 'ko' | 'en') => (locale === 'ko' ? '공약 이행 현황판' : 'Pledge status'), to: '/pledges' },
] as const;

export function VotesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<VoteSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pageContainerClass = 'mx-auto max-w-[1600px]';

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void voteApi
      .list(locale, controller.signal)
      .then((response) => {
        setItems(response.items);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [locale]);

  const cardsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / cardsPerPage));
  const currentItems = items.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
  const getPageNumbers = () => {
    const pageGroupSize = 10;
    const startPage = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1;
    const endPage = Math.min(totalPages, startPage + pageGroupSize - 1);
    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [locale]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="min-h-screen bg-[#F7FCFC]">
      <Header showLogo />
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
        <div className={pageContainerClass}>
          <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-white">{locale === 'ko' ? '투표' : 'Votes'}</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">
            {locale === 'ko' ? '공개된 투표와 참여 현황을 확인합니다.' : 'View public votes and turnout.'}
          </p>
        </div>
      </div>

      <div className="border-b border-kaist-grey/30 bg-[#F7FCFC]">
        <div className={`${pageContainerClass} flex flex-wrap items-stretch gap-5 sm:gap-8 lg:gap-12`}>
          {voteTabs.map((tab, index) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="group relative min-h-11"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              aria-current={tab.to === '/votes' ? 'page' : undefined}
            >
              <span className={`relative flex h-full items-center justify-center text-[20px] font-bold tracking-tight transition-colors ${tab.to === '/votes' ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                <span className="py-3.5">{tab.label(locale)}</span>
                <span className={`absolute bottom-0 left-0 right-0 h-1 origin-center bg-kaist-darkgreen transition-transform duration-200 ${tab.to === '/votes' || hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] pb-5 pt-12">
        {status === 'loading' ? <p role="status" className="py-20 text-center text-base font-semibold text-kaist-grey">Loading votes.</p> : null}
        {status === 'error' ? <p role="alert" className="py-20 text-center text-base font-semibold text-red-700">Could not load votes.</p> : null}
        {status === 'ready' && items.length === 0 ? <p className="py-20 text-center text-base font-semibold text-kaist-grey">No public votes are available.</p> : null}

        <div className="flex h-[min(calc(100svh-420px))] min-h-[390px] flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-2 gap-x-3 gap-y-3 sm:gap-x-4 lg:gap-x-5 lg:gap-y-4 xl:gap-x-7 xl:gap-y-7">
          {currentItems.map((item) => (
            <Link
              key={item.id}
              to={`/votes/${item.id}`}
              className="group flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-kaist-grey/10 bg-white shadow-[-1px_0px_4px_rgba(0,0,0,0.12),1px_2px_4px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-kaist-darkgreen"
            >
              <div className="relative h-3/5 min-h-[108px] shrink-0 overflow-hidden bg-[linear-gradient(135deg,#146D4A_0%,#5B93C4_58%,#C9ECC2_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.42),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))] transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
                  <div className="rounded-2xl border border-white/25 bg-white/15 p-4 text-white shadow-sm backdrop-blur-sm">
                    <BarChart3 className="h-10 w-10" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-kaist-darkgreen px-2 py-0.5 text-[10px] font-bold text-white">{stateLabel[item.state]}</span>
                <span className="absolute bottom-2.5 right-2.5 rounded-[4px] bg-white/85 px-1.5 py-0.5 text-[8px] font-semibold text-kaist-black">{new Date(item.closesAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-2.5 py-2 sm:px-3 xl:px-3.5 xl:pb-2.5 xl:pt-2">
                <p className="text-[10px] font-semibold tracking-tight text-[#5B93C4]">{locale === 'ko' ? '투표' : 'Vote'}</p>
                <h2 className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-[15px] font-extrabold leading-[18px] tracking-tight text-kaist-black xl:text-[16px] xl:leading-[19px]">{item.title.value}</h2>
                <p className="mt-0.5 line-clamp-1 min-h-4 text-[10px] font-semibold leading-4 text-kaist-grey xl:text-[11px]">{item.description.value}</p>
                <div className="mt-auto">
                <div className="mb-1.5 flex justify-between text-[10px] font-bold text-kaist-darkgreen">
                  <span>{locale === 'ko' ? '전체 투표율' : 'Turnout'}</span>
                  <span>{item.turnoutPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-kaist-grey/20">
                  <div className="h-full bg-kaist-darkgreen" style={{ width: `${Math.min(100, item.turnoutPercent)}%` }} />
                </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {status === 'ready' && items.length > 0 && totalPages > 1 ? (
          <nav aria-label={locale === 'ko' ? '페이지 이동' : 'Pagination'} className="mt-12 flex shrink-0 items-center justify-center gap-2 text-[18px] font-semibold tracking-tight text-kaist-black">
            <button type="button" onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`p-1 transition-colors ${currentPage === 1 ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            {getPageNumbers().map((page) => (
              <button key={page} type="button" onClick={() => handlePageChange(page)} className={`h-[33px] min-w-[33px] rounded-[5px] px-3 text-[18px] font-semibold tracking-tight transition-colors ${currentPage === page ? 'bg-kaist-darkgreen-main text-kaist-white' : 'text-kaist-black hover:bg-kaist-grey/10'}`}>
                {page}
              </button>
            ))}
            <button type="button" onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`p-2 transition-colors ${currentPage === totalPages ? 'cursor-not-allowed text-kaist-grey/30' : 'text-kaist-darkgreen hover:bg-kaist-grey/10'}`}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        ) : null}
        </div>
      </main>
    </div>
  );
}
