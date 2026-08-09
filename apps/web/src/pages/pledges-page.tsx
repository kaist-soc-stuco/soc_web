import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Pledge } from '@soc/contracts';

import { Header } from '@/components/organisms/header';
import { pledgeApi } from '@/lib/governance-api';
import { useLocale } from '@/lib/locale-store';

const statusLabel: Record<Pledge['status'], string> = { PLANNED: '예정', IN_PROGRESS: '진행 중', DONE: '완료', BLOCKED: '보류' };

export function PledgesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<Pledge[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void pledgeApi.list(locale, controller.signal)
      .then((response) => { setItems(response.items); setStatus('ready'); })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [locale]);

  return <div className="min-h-screen bg-[#F7FCFC]"><Header showLogo/><main className="mx-auto w-full max-w-5xl px-6 py-12">
    <Link to="/about" className="text-sm font-bold text-kaist-darkgreen">← 소개</Link>
    <h1 className="mt-5 text-4xl font-extrabold">공약 이행 현황판</h1>
    <p className="mt-3 text-kaist-grey">학생회 공약과 현재까지의 이행 상황을 공개합니다.</p>
    {status === 'loading' && <p role="status" className="mt-10">불러오는 중…</p>}
    {status === 'error' && <p role="alert" className="mt-10 text-red-700">공약 현황을 불러오지 못했습니다.</p>}
    {status === 'ready' && items.length === 0 && <p className="mt-10 text-kaist-grey">공개된 공약이 없습니다.</p>}
    <div className="mt-8 space-y-3">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const detailsId = 'pledge-details-' + item.id;
        return <article key={item.id} className="rounded border bg-white">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
            className="flex min-h-20 w-full items-center gap-4 p-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kaist-darkgreen"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-kaist-darkgreen font-bold text-white">{item.ordinal + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold">{item.title.value}</span>
              <span className="mt-1 block text-xs font-bold text-kaist-darkgreen">{statusLabel[item.status]} · {item.progressPercent}%</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-kaist-grey">{isExpanded ? '−' : '+'}</span>
          </button>
          {isExpanded && <div id={detailsId} className="border-t px-5 pb-6 pt-4">
            <p className="whitespace-pre-line leading-7">{item.description.value}</p>
            <div
              className="mt-5 h-3 overflow-hidden rounded bg-kaist-grey/20"
              role="progressbar"
              aria-label={(item.title.value ?? '공약') + ' 진행률'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.progressPercent}
            >
              <div className="h-full bg-kaist-darkgreen" style={{ width: item.progressPercent + '%' }}/>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-kaist-grey">{item.progress.value}</p>
            {item.targetDate && <p className="mt-3 text-xs font-bold text-kaist-grey">목표일: {item.targetDate}</p>}
          </div>}
        </article>;
      })}
    </div>
  </main></div>;
}
