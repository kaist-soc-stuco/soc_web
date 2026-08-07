import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { VoteDetail } from '@soc/contracts';

import { Header } from '@/components/organisms/header';
import { useAuthSession } from '@/lib/auth-session';
import { GovernanceApiError, voteApi } from '@/lib/governance-api';
import { useLocale } from '@/lib/locale-store';

export function VoteDetailPage() {
  const [locale] = useLocale();
  const auth = useAuthSession();
  const { voteId } = useParams<{ voteId: string }>();
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const load = async (signal?: AbortSignal) => {
    if (!voteId) { setStatus('error'); return; }
    try { const result = await voteApi.get(voteId, locale, signal); setVote(result); setStatus('ready'); } catch (error: unknown) { if ((error as { name?: string }).name !== 'AbortError') setStatus('error'); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [voteId, locale]);
  useEffect(() => { if (!vote || vote.state !== 'OPEN') return; const timer = window.setInterval(() => void load(), 15_000); return () => window.clearInterval(timer); }, [vote?.state, voteId, locale]);
  const cast = async () => {
    if (!voteId || !selected) return;
    setMessage('');
    try { await voteApi.cast(voteId, selected); setMessage('투표가 접수되었습니다.'); await load(); } catch (error: unknown) { setMessage(error instanceof GovernanceApiError ? error.code ?? '투표에 실패했습니다.' : '투표에 실패했습니다.'); }
  };
  return <div className="min-h-screen bg-[#F7FCFC]"><Header showLogo/><main className="mx-auto w-full max-w-4xl px-6 py-12">
    <Link to="/votes" className="text-sm font-bold text-kaist-darkgreen">← 투표 목록</Link>
    {status === 'loading' && <p role="status" className="mt-10">불러오는 중…</p>}
    {status === 'error' && <p role="alert" className="mt-10">투표를 찾을 수 없습니다.</p>}
    {vote && <article className="mt-6 rounded border bg-white p-6 md:p-10"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-kaist-darkgreen px-3 py-1 text-xs font-bold text-white">{vote.state === 'OPEN' ? '진행 중' : vote.state === 'RESULTS_PUBLISHED' ? '결과 공개' : '투표 종료'}</span><span className="text-sm text-kaist-grey">{new Date(vote.opensAt).toLocaleString('ko-KR')} ~ {new Date(vote.closesAt).toLocaleString('ko-KR')}</span></div>
      <h1 className="mt-5 text-3xl font-extrabold">{vote.title.value}</h1><p className="mt-3 whitespace-pre-line leading-7 text-kaist-grey">{vote.description.value}</p>
      <div className="mt-8 rounded bg-kaist-grey/10 p-4"><div className="flex justify-between text-sm font-bold"><span>전체 투표율</span><span>{vote.turnoutPercent}%</span></div><div className="mt-2 h-3 overflow-hidden rounded bg-white"><div className="h-full bg-kaist-darkgreen" style={{ width: `${Math.min(100, vote.turnoutPercent)}%` }}/></div><p className="mt-2 text-xs text-kaist-grey">유효 투표율 기준: {vote.validTurnoutPercent}% · 후보자별 득표율은 개표 전 공개하지 않습니다.</p></div>
      {vote.state === 'OPEN' && <section className="mt-8"><h2 className="text-xl font-extrabold">후보자</h2><div className="mt-4 grid gap-3">{vote.candidates.map((candidate) => <label key={candidate.id} className={`flex cursor-pointer gap-3 rounded border p-4 ${selected === candidate.id ? 'border-kaist-darkgreen ring-1 ring-kaist-darkgreen' : ''}`}><input type="radio" name="candidate" value={candidate.id} checked={selected === candidate.id} onChange={() => setSelected(candidate.id)} disabled={vote.participation === 'VOTED' || vote.participation === 'INELIGIBLE'}/><span><span className="block font-extrabold">{candidate.name.value}</span><span className="block text-sm text-kaist-grey">{candidate.description.value}</span></span></label>)}</div>
        {!auth.session.authenticated && <p className="mt-4 text-sm text-kaist-grey">투표하려면 먼저 <Link className="font-bold underline" to="/login">로그인</Link>하세요.</p>}
        {auth.session.authenticated && vote.participation === 'INELIGIBLE' && <p className="mt-4 text-sm text-red-700">선거인명부에 등록된 구성원만 투표할 수 있습니다.</p>}
        {auth.session.authenticated && vote.participation === 'VOTED' && <p className="mt-4 text-sm font-bold text-kaist-darkgreen">이미 투표했습니다.</p>}
        {auth.session.authenticated && vote.participation === 'ELIGIBLE' && <button type="button" onClick={() => void cast()} disabled={!selected} className="mt-5 rounded bg-kaist-darkgreen px-5 py-3 font-bold text-white disabled:opacity-40">투표하기</button>}
      </section>}
      {vote.results && <section className="mt-8"><h2 className="text-xl font-extrabold">개표 결과</h2><div className="mt-4 space-y-4">{vote.results.map((result) => <div key={result.candidate.id}><div className="flex justify-between text-sm font-bold"><span>{result.candidate.name.value}</span><span>{result.percent}% ({result.voteCount}표)</span></div><div className="mt-1 h-3 rounded bg-kaist-grey/20"><div className="h-full rounded bg-kaist-darkgreen" style={{ width: `${result.percent}%` }}/></div></div>)}</div><p className="mt-4 text-xs text-kaist-grey">결과 공개 기한: {vote.resultsVisibleUntil ? new Date(vote.resultsVisibleUntil).toLocaleString('ko-KR') : '-'}</p></section>}
      {message && <p role="status" className="mt-5 text-sm font-bold text-kaist-darkgreen">{message}</p>}
    </article>}
  </main></div>;
}
