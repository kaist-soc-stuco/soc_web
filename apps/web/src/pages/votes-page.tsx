import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { VoteSummary } from '@soc/contracts';

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

export function VotesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<VoteSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

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

  return (
    <div className="min-h-screen bg-[#F7FCFC]">
      <Header showLogo />
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-[36px] font-extrabold tracking-tight text-white">{locale === 'ko' ? '투표' : 'Votes'}</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">
            {locale === 'ko' ? '공개된 투표와 참여 현황을 확인합니다.' : 'View public votes and turnout.'}
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-16 pt-10">
        {status === 'loading' ? <p role="status" className="py-20 text-center text-base font-semibold text-kaist-grey">Loading votes.</p> : null}
        {status === 'error' ? <p role="alert" className="py-20 text-center text-base font-semibold text-red-700">Could not load votes.</p> : null}
        {status === 'ready' && items.length === 0 ? <p className="py-20 text-center text-base font-semibold text-kaist-grey">No public votes are available.</p> : null}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/votes/${item.id}`}
              className="rounded-[15px] border border-kaist-grey/10 bg-white p-6 shadow-[-1px_0px_4px_rgba(0,0,0,0.12),1px_2px_4px_rgba(0,0,0,0.12)] transition hover:-translate-y-1 hover:border-kaist-darkgreen"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-bold text-white">{stateLabel[item.state]}</span>
                <span className="text-xs font-semibold text-kaist-grey">{new Date(item.closesAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}</span>
              </div>
              <h2 className="mt-5 text-[24px] font-extrabold tracking-tight text-kaist-black">{item.title.value}</h2>
              <p className="mt-3 line-clamp-3 text-[13px] font-semibold leading-6 text-kaist-grey">{item.description.value}</p>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-bold text-kaist-darkgreen">
                  <span>{locale === 'ko' ? '전체 투표율' : 'Turnout'}</span>
                  <span>{item.turnoutPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-kaist-grey/20">
                  <div className="h-full bg-kaist-darkgreen" style={{ width: `${Math.min(100, item.turnoutPercent)}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
