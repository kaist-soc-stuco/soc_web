import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Pledge } from '@soc/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Header } from '@/components/organisms/header';
import { pledgeApi } from '@/lib/governance-api';
import { useLocale } from '@/lib/locale-store';

const statusLabel: Record<'ko' | 'en', Record<Pledge['status'], string>> = {
  ko: { PLANNED: '예정', IN_PROGRESS: '진행 중', DONE: '완료', BLOCKED: '보류' },
  en: { PLANNED: 'Planned', IN_PROGRESS: 'In progress', DONE: 'Done', BLOCKED: 'Blocked' },
};
const voteTabs = [
  { label: (locale: 'ko' | 'en') => (locale === 'ko' ? '투표' : 'Votes'), to: '/votes' },
  { label: (locale: 'ko' | 'en') => (locale === 'ko' ? '공약 이행 현황판' : 'Pledge status'), to: '/pledges' },
] as const;

export function PledgesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<Pledge[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pageContainerClass = 'mx-auto max-w-[1600px]';
  const copy = locale === 'ko'
    ? {
      loading: '공약 현황을 불러오는 중입니다.',
      error: '공약 현황을 불러오지 못했습니다.',
      empty: '공개된 공약이 없습니다.',
      target: '목표일',
      progress: '진행률',
    }
    : {
      loading: 'Loading pledges.',
      error: 'Could not load pledges.',
      empty: 'No public pledges are available.',
      target: 'Target',
      progress: 'progress',
    };

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void pledgeApi
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
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
    setExpandedId(null);
  }, [locale]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="min-h-screen bg-[#F7FCFC]">
      <Header showLogo />
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
        <div className={pageContainerClass}>
          <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-white">{locale === 'ko' ? '공약 이행 현황' : 'Pledge Progress'}</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">
            {locale === 'ko' ? '학생회 공약과 현재까지의 이행 상황을 공개합니다.' : 'Track student council pledges and progress.'}
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
              aria-current={tab.to === '/pledges' ? 'page' : undefined}
            >
              <span className={`relative flex h-full items-center justify-center text-[20px] font-bold tracking-tight transition-colors ${tab.to === '/pledges' ? 'text-kaist-darkgreen' : 'text-kaist-greygreen hover:text-kaist-darkgreen'}`}>
                <span className="py-3.5">{tab.label(locale)}</span>
                <span className={`absolute bottom-0 left-0 right-0 h-1 origin-center bg-kaist-darkgreen transition-transform duration-200 ${tab.to === '/pledges' || hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] pb-10 pt-6">
        {status === 'loading' ? <p role="status" className="py-20 text-center text-base font-semibold text-kaist-grey">{copy.loading}</p> : null}
        {status === 'error' ? <p role="alert" className="py-20 text-center text-base font-semibold text-red-700">{copy.error}</p> : null}
        {status === 'ready' && items.length === 0 ? <p className="py-20 text-center text-base font-semibold text-kaist-grey">{copy.empty}</p> : null}

        <div className="grid auto-rows-fr gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5 xl:gap-x-8 xl:gap-y-6">
          {currentItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const detailsId = 'pledge-details-' + item.id;
            return (
              <article key={item.id} className="overflow-hidden rounded-[8px] border border-kaist-grey/10 bg-white shadow-[-1px_0px_4px_rgba(0,0,0,0.12),1px_2px_4px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-kaist-darkgreen">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                  className="flex h-full min-h-[clamp(210px,18vw,248px)] w-full flex-col items-start gap-2.5 px-3.5 py-3.5 text-left transition hover:bg-kaist-grey/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kaist-darkgreen xl:gap-3 xl:px-4 xl:py-4"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-kaist-darkgreen text-xs font-extrabold text-white">{item.ordinal + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 min-h-[2.625rem] text-[18px] font-extrabold leading-[21px] tracking-tight text-kaist-black">{item.title.value}</span>
                    <span className="mt-2 block text-[11px] font-bold text-kaist-darkgreen">{statusLabel[locale][item.status]} · {item.progressPercent}%</span>
                    <span className="mt-1.5 line-clamp-3 min-h-[3.375rem] text-[11px] font-semibold leading-[18px] text-kaist-grey xl:mt-2">{item.description.value}</span>
                  </span>
                  <span aria-hidden="true" className="mt-auto self-end text-xl font-extrabold text-kaist-grey">{isExpanded ? '-' : '+'}</span>
                </button>
                {isExpanded ? (
                  <div id={detailsId} className="border-t border-kaist-grey/20 px-6 pb-6 pt-5">
                    <p className="whitespace-pre-line text-sm font-medium leading-7 text-kaist-black">{item.description.value}</p>
                    <div className="mt-5 h-3 overflow-hidden rounded bg-kaist-grey/20" role="progressbar" aria-label={(item.title.value ?? 'Pledge') + ' ' + copy.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progressPercent}>
                      <div className="h-full bg-kaist-darkgreen" style={{ width: item.progressPercent + '%' }} />
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-kaist-grey">{item.progress.value}</p>
                    {item.targetDate ? <p className="mt-3 text-xs font-bold text-kaist-grey">{copy.target}: {item.targetDate}</p> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {status === 'ready' && items.length > 0 && totalPages > 1 ? (
          <nav aria-label={locale === 'ko' ? '페이지 이동' : 'Pagination'} className="mt-7 flex items-center justify-center gap-2 text-[18px] font-semibold tracking-tight text-kaist-black">
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
      </main>
    </div>
  );
}
