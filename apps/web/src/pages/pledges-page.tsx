import { useEffect, useState } from 'react';
import type { Pledge } from '@soc/contracts';

import { Header } from '@/components/organisms/header';
import { pledgeApi } from '@/lib/governance-api';
import { useLocale } from '@/lib/locale-store';

const statusLabel: Record<Pledge['status'], string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export function PledgesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<Pledge[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

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

  return (
    <div className="min-h-screen bg-[#F7FCFC]">
      <Header showLogo />
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-[36px] font-extrabold tracking-tight text-white">{locale === 'ko' ? '공약 이행 현황' : 'Pledge Progress'}</h1>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-white">
            {locale === 'ko' ? '학생회 공약과 현재까지의 이행 상황을 공개합니다.' : 'Track student council pledges and progress.'}
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-16 pt-10">
        {status === 'loading' ? <p role="status" className="py-20 text-center text-base font-semibold text-kaist-grey">Loading pledges.</p> : null}
        {status === 'error' ? <p role="alert" className="py-20 text-center text-base font-semibold text-red-700">Could not load pledges.</p> : null}
        {status === 'ready' && items.length === 0 ? <p className="py-20 text-center text-base font-semibold text-kaist-grey">No public pledges are available.</p> : null}

        <div className="space-y-4">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const detailsId = 'pledge-details-' + item.id;
            return (
              <article key={item.id} className="overflow-hidden rounded-[15px] border border-kaist-grey/10 bg-white shadow-[-1px_0px_4px_rgba(0,0,0,0.12),1px_2px_4px_rgba(0,0,0,0.12)]">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                  className="flex min-h-24 w-full items-center gap-5 px-6 py-5 text-left transition hover:bg-kaist-grey/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kaist-darkgreen"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-kaist-darkgreen text-sm font-extrabold text-white">{item.ordinal + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[22px] font-extrabold tracking-tight text-kaist-black">{item.title.value}</span>
                    <span className="mt-2 block text-xs font-bold text-kaist-darkgreen">{statusLabel[item.status]} · {item.progressPercent}%</span>
                  </span>
                  <span aria-hidden="true" className="text-2xl font-extrabold text-kaist-grey">{isExpanded ? '-' : '+'}</span>
                </button>
                {isExpanded ? (
                  <div id={detailsId} className="border-t border-kaist-grey/20 px-6 pb-6 pt-5">
                    <p className="whitespace-pre-line text-sm font-medium leading-7 text-kaist-black">{item.description.value}</p>
                    <div className="mt-5 h-3 overflow-hidden rounded bg-kaist-grey/20" role="progressbar" aria-label={(item.title.value ?? 'Pledge') + ' progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progressPercent}>
                      <div className="h-full bg-kaist-darkgreen" style={{ width: item.progressPercent + '%' }} />
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-kaist-grey">{item.progress.value}</p>
                    {item.targetDate ? <p className="mt-3 text-xs font-bold text-kaist-grey">Target: {item.targetDate}</p> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
