import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { VoteDetail } from '@soc/contracts';

import { Header } from '@/components/organisms/header';
import { useAuthSession } from '@/lib/auth-session';
import { GovernanceApiError, voteApi } from '@/lib/governance-api';
import { useLocale } from '@/lib/locale-store';

const stateLabel = (state: VoteDetail['state'], locale: 'ko' | 'en') => {
  if (state === 'OPEN') return locale === 'ko' ? '진행 중' : 'Open';
  if (state === 'RESULTS_PUBLISHED') return locale === 'ko' ? '결과 공개' : 'Results published';
  return locale === 'ko' ? '투표 종료' : 'Closed';
};

export function VoteDetailPage() {
  const [locale] = useLocale();
  const auth = useAuthSession();
  const { voteId } = useParams<{ voteId: string }>();
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = async (signal?: AbortSignal) => {
    if (!voteId) {
      setStatus('error');
      return;
    }

    try {
      const result = await voteApi.get(voteId, locale, signal);
      setVote(result);
      setStatus('ready');
    } catch (error: unknown) {
      if ((error as { name?: string }).name !== 'AbortError') setStatus('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [voteId, locale]);

  useEffect(() => {
    if (!vote || vote.state !== 'OPEN') return;
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [vote?.state, voteId, locale]);

  const cast = async () => {
    if (!voteId || !selected) return;
    setMessage('');
    try {
      await voteApi.cast(voteId, selected);
      setMessage(locale === 'ko' ? '투표가 접수되었습니다.' : 'Your vote has been submitted.');
      await load();
    } catch (error: unknown) {
      setMessage(
        error instanceof GovernanceApiError
          ? error.code ?? (locale === 'ko' ? '투표에 실패했습니다.' : 'Unable to cast your vote.')
          : locale === 'ko'
            ? '투표에 실패했습니다.'
            : 'Unable to cast your vote.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FCFC]">
      <Header showLogo />
      <main className="mx-auto w-full max-w-[1200px] px-6 py-12">
        <Link to="/votes" className="inline-flex text-sm font-extrabold text-kaist-darkgreen transition hover:text-kaist-darkgreen-main">
          {locale === 'ko' ? '투표 목록' : 'Vote list'}
        </Link>

        {status === 'loading' && <p role="status" className="mt-10 text-center font-semibold text-kaist-grey">{locale === 'ko' ? '불러오는 중...' : 'Loading...'}</p>}
        {status === 'error' && <p role="alert" className="mt-10 text-center font-semibold text-kaist-grey">{locale === 'ko' ? '투표를 찾을 수 없습니다.' : 'Unable to find this vote.'}</p>}

        {vote && (
          <article className="mt-6 overflow-hidden rounded-[8px] border border-kaist-grey/15 bg-white shadow-[0_20px_70px_rgba(57,64,75,0.10)]">
            <div className="h-4 bg-[linear-gradient(90deg,#006B4A_0%,#8DCDAE_100%)]" />
            <div className="p-7 md:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-kaist-darkgreen px-4 py-1.5 text-xs font-extrabold text-white">{stateLabel(vote.state, locale)}</span>
                <span className="text-sm font-semibold text-kaist-grey">
                  {new Date(vote.opensAt).toLocaleString('ko-KR')} ~ {new Date(vote.closesAt).toLocaleString('ko-KR')}
                </span>
              </div>

              <h1 className="mt-6 text-[32px] font-extrabold leading-tight tracking-tight text-kaist-black md:text-[38px]">{vote.title.value}</h1>
              <p className="mt-4 whitespace-pre-line text-base font-medium leading-8 text-kaist-grey">{vote.description.value}</p>

              <div className="mt-8 rounded-[8px] border border-kaist-grey/15 bg-[#F7FCFC] p-5">
                <div className="flex justify-between text-sm font-extrabold text-kaist-black">
                  <span>{locale === 'ko' ? '전체 투표율' : 'Turnout'}</span>
                  <span>{vote.turnoutPercent}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-kaist-darkgreen" style={{ width: `${Math.min(100, vote.turnoutPercent)}%` }} />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-kaist-grey">
                  {locale === 'ko'
                    ? `유효 투표율 기준: ${vote.validTurnoutPercent}% · 후보자별 득표수는 개표 후 공개됩니다.`
                    : `Valid turnout threshold: ${vote.validTurnoutPercent}% · Candidate counts are shown after publication.`}
                </p>
              </div>

              {vote.state === 'OPEN' && (
                <section className="mt-8">
                  <h2 className="text-2xl font-extrabold text-kaist-black">{locale === 'ko' ? '후보자' : 'Candidates'}</h2>
                  <div className="mt-4 grid gap-3">
                    {vote.candidates.map((candidate) => (
                      <label key={candidate.id} className={`flex cursor-pointer gap-3 rounded-[8px] border bg-white p-5 transition ${selected === candidate.id ? 'border-kaist-darkgreen ring-2 ring-kaist-darkgreen/20' : 'border-kaist-grey/20 hover:border-kaist-darkgreen/40'}`}>
                        <input
                          type="radio"
                          name="candidate"
                          value={candidate.id}
                          checked={selected === candidate.id}
                          onChange={() => setSelected(candidate.id)}
                          disabled={vote.participation === 'VOTED' || vote.participation === 'INELIGIBLE'}
                          className="mt-1 accent-kaist-darkgreen"
                        />
                        <span>
                          <span className="block text-base font-extrabold text-kaist-black">{candidate.name.value}</span>
                          <span className="mt-1 block text-sm font-medium leading-6 text-kaist-grey">{candidate.description.value}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {!auth.session.authenticated && (
                    <p className="mt-4 text-sm font-semibold text-kaist-grey">
                      {locale === 'ko' ? '투표하려면 먼저 ' : 'Please '}
                      <Link className="font-extrabold text-kaist-darkgreen underline" to="/login">{locale === 'ko' ? '로그인' : 'sign in'}</Link>
                      {locale === 'ko' ? '하세요.' : ' to vote.'}
                    </p>
                  )}
                  {auth.session.authenticated && vote.participation === 'INELIGIBLE' && <p className="mt-4 text-sm font-semibold text-red-700">{locale === 'ko' ? '선거인 명부에 등록된 구성원만 투표할 수 있습니다.' : 'Only registered voters are eligible.'}</p>}
                  {auth.session.authenticated && vote.participation === 'VOTED' && <p className="mt-4 text-sm font-extrabold text-kaist-darkgreen">{locale === 'ko' ? '이미 투표했습니다.' : 'You have already voted.'}</p>}
                  {auth.session.authenticated && vote.participation === 'ELIGIBLE' && (
                    <button type="button" onClick={() => void cast()} disabled={!selected} className="mt-5 rounded-[5px] bg-kaist-darkgreen px-6 py-3 font-extrabold text-white transition hover:bg-kaist-darkgreen-main disabled:opacity-40">
                      {locale === 'ko' ? '투표하기' : 'Cast vote'}
                    </button>
                  )}
                </section>
              )}

              {vote.results && (
                <section className="mt-8">
                  <h2 className="text-2xl font-extrabold text-kaist-black">{locale === 'ko' ? '개표 결과' : 'Results'}</h2>
                  <div className="mt-4 space-y-4">
                    {vote.results.map((result) => (
                      <div key={result.candidate.id}>
                        <div className="flex justify-between text-sm font-extrabold text-kaist-black">
                          <span>{result.candidate.name.value}</span>
                          <span>{result.percent}% ({result.voteCount})</span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-kaist-grey/20">
                          <div className="h-full rounded-full bg-kaist-darkgreen" style={{ width: `${result.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold text-kaist-grey">
                    {locale === 'ko' ? '결과 공개 기한' : 'Results visible until'}: {vote.resultsVisibleUntil ? new Date(vote.resultsVisibleUntil).toLocaleString('ko-KR') : '-'}
                  </p>
                </section>
              )}

              {message && <p role="status" className="mt-5 text-sm font-extrabold text-kaist-darkgreen">{message}</p>}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
