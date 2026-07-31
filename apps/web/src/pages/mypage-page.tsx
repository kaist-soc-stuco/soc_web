import { FormEvent, useEffect, useState } from 'react';
import type { MySurveyResponsesResponse, UserMeResponse } from '@soc/contracts';

import { SiteLayout } from '@/components/organisms/site-layout';
import { profileApi, ProfileApiError } from '@/lib/profile-api';
import { surveyApi } from '@/lib/survey-api';

const feeLabel = { PAID: '납부 완료', UNPAID: '미납', UNKNOWN: '확인 중' } as const;
const value = (input: string | null) => input || '-';

export function MyPage() {
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<MySurveyResponsesResponse['items']>([]);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void profileApi.get(controller.signal).then((loaded) => {
      setProfile(loaded);
      void surveyApi.mineAll(controller.signal).then((surveys) => setSurveyResponses(surveys.items)).catch(() => undefined);
      setEmail(loaded.userEmail ?? '');
      setMobile(loaded.userMobile ?? '');
      setStatus('ready');
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setMessage(cause instanceof ProfileApiError && cause.status === 401 ? '로그인이 필요합니다.' : '내 정보를 불러오지 못했습니다.');
      setStatus('error');
    });
    return () => controller.abort();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      const updated = await profileApi.update({ userEmail: email.trim() || null, userMobile: mobile.trim() || null });
      setProfile(updated);
      setEmail(updated.userEmail ?? '');
      setMobile(updated.userMobile ?? '');
      setMessage('연락처를 저장했습니다.');
      setStatus('ready');
    } catch {
      setMessage('연락처를 저장하지 못했습니다.');
      setStatus('ready');
    }
  };

  return (
    <SiteLayout>
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-4xl px-6 py-12">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">마이페이지</h1>
        {status === 'loading' ? <p role="status" className="mt-8">내 정보를 불러오는 중입니다.</p> : null}
        {status === 'error' ? <p role="alert" className="mt-8 text-red-600">{message}</p> : null}
        {profile ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-kaist-grey/25 bg-white p-6">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">기본 정보</h2>
              <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
                <dt className="font-semibold">이름</dt><dd>{value(profile.nameKr ?? profile.nameEn)}</dd>
                <dt className="font-semibold">학번/사번</dt><dd>{value(profile.studentOrEmployeeNumber)}</dd>
                <dt className="font-semibold">KAIST UID</dt><dd>{value(profile.kaistUid)}</dd>
                <dt className="font-semibold">과비 납부</dt><dd>{feeLabel[profile.feeStatus]}</dd>
              </dl>
            </section>
            <form onSubmit={submit} className="rounded-lg border border-kaist-grey/25 bg-white p-6">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">연락처</h2>
              <label className="mt-5 block text-sm font-semibold" htmlFor="mypage-email">이메일</label>
              <input id="mypage-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded border border-kaist-grey/40 px-3 py-2" />
              <label className="mt-4 block text-sm font-semibold" htmlFor="mypage-mobile">전화번호</label>
              <input id="mypage-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} className="mt-2 w-full rounded border border-kaist-grey/40 px-3 py-2" />
              <button type="submit" disabled={status === 'saving'} className="mt-5 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-60">{status === 'saving' ? '저장 중...' : '저장'}</button>
              {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
            </form>
            <section className="rounded-lg border border-kaist-grey/25 bg-white p-6 md:col-span-2">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">내 설문 응답</h2>
              {surveyResponses.length === 0 ? <p className="mt-4 text-sm">제출한 설문 응답이 없습니다.</p> : (
                <ul className="mt-4 divide-y">
                  {surveyResponses.map(({ survey, response }) => (
                    <li key={response.id} className="flex items-center justify-between py-3">
                      <a className="font-semibold underline" href={`/survey/${survey.id}`}>{survey.title.value}</a>
                      <span className="text-sm">{response.state} · {response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '-'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </SiteLayout>
  );
}
