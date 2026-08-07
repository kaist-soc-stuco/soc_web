import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { VoteSummary } from '@soc/contracts';

import { Header } from '@/components/organisms/header';
import { useLocale } from '@/lib/locale-store';
import { voteApi } from '@/lib/governance-api';

const stateLabel: Record<VoteSummary['state'], string> = {
  DRAFT: '준비 중', SCHEDULED: '예정', OPEN: '진행 중', CLOSED: '투표 종료', DISCARDED: '무효', RESULTS_PUBLISHED: '결과 공개', RESULTS_RETIRED: '결과 비공개',
};

export function VotesPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<VoteSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void voteApi.list(locale, controller.signal).then((response) => { setItems(response.items); setStatus('ready'); }).catch((error: unknown) => { if ((error as { name?: string }).name !== 'AbortError') setStatus('error'); });
    return () => controller.abort();
  }, [locale]);
  return <div className="min-h-screen bg-[#F7FCFC]"><Header showLogo/><main className="mx-auto w-full max-w-5xl px-6 py-12">
    <h1 className="text-4xl font-extrabold">투표</h1>
    <p className="mt-3 text-kaist-grey">재학생·교직원 선거인명부에 등록된 구성원만 참여할 수 있습니다.</p>
    {status === 'loading' && <p role="status" className="mt-10">불러오는 중…</p>}
    {status === 'error' && <p role="alert" className="mt-10 text-red-700">투표 목록을 불러오지 못했습니다.</p>}
    {status === 'ready' && items.length === 0 && <p className="mt-10">현재 공개된 투표가 없습니다.</p>}
    <div className="mt-8 grid gap-5 md:grid-cols-2">{items.map((item) => <Link key={item.id} to={`/votes/${item.id}`} className="rounded border bg-white p-6 transition hover:border-kaist-darkgreen">
      <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-bold text-white">{stateLabel[item.state]}</span><span className="text-xs text-kaist-grey">{new Date(item.closesAt).toLocaleString('ko-KR')}</span></div>
      <h2 className="mt-5 text-2xl font-extrabold">{item.title.value}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-kaist-grey">{item.description.value}</p>
      <div className="mt-5"><div className="mb-1 flex justify-between text-xs font-bold"><span>전체 투표율</span><span>{item.turnoutPercent}%</span></div><div className="h-2 overflow-hidden rounded bg-kaist-grey/20"><div className="h-full bg-kaist-darkgreen" style={{ width: `${Math.min(100, item.turnoutPercent)}%` }}/></div></div>
    </Link>)}</div>
  </main></div>;
}
