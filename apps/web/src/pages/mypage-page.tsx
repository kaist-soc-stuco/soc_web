import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { MySurveyResponsesResponse, UserMeResponse } from '@soc/contracts';
import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { profileApi, ProfileApiError } from '@/lib/profile-api';
import { surveyApi } from '@/lib/survey-api';

const feeLabel = { PAID: '납부 완료', UNPAID: '미납', UNKNOWN: '확인 중' } as const;
const responseStateLabel: Record<string, string> = {
  DRAFT: '작성 중',
  SUBMITTED: '제출 완료',
  REVIEWED: '검토 완료',
  REJECTED: '반려',
};
const value = (input: string | null) => input || '-';
const affiliationLabel = (mask: number) => {
  if (mask === 0) return '소속 정보 없음';
  if (mask === 1) return '전산학부';
  return `전산학부 외 복수 소속 (코드 ${mask})`;
};

export function MyPage() {
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<MySurveyResponsesResponse['items'] | null>(null);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [surveyError, setSurveyError] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    setStatus('loading');
    setMessage('');
    setSurveyError(false);
    setSurveyResponses(null);
    void profileApi.get(signal).then((loaded) => {
      setProfile(loaded);
      void surveyApi.mineAll(signal)
        .then((surveys) => setSurveyResponses(surveys.items))
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          setSurveyError(true);
        });
      setEmail(loaded.userEmail ?? '');
      setMobile(loaded.userMobile ?? '');
      setStatus('ready');
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setProfile(null);
      setMessage(cause instanceof ProfileApiError && cause.status === 401 ? '로그인이 필요합니다.' : '내 정보를 불러오지 못했습니다.');
      setStatus('error');
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

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
        {status === 'error' ? (
          <div role="alert" className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{message}</p>
            <div className="mt-3 flex gap-4">
              {message === '로그인이 필요합니다.' ? <Link className="font-bold underline" to="/login">로그인 페이지로 이동</Link> : <button type="button" className="font-bold underline" onClick={() => load()}>다시 시도</button>}
              <Link className="font-bold underline" to="/">홈으로 이동</Link>
            </div>
          </div>
        ) : null}
        {profile ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-kaist-grey/25 bg-white p-6">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">기본 정보</h2>
              <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
                <dt className="font-semibold">한글 이름</dt><dd>{value(profile.nameKr)}</dd>
                <dt className="font-semibold">영문 이름</dt><dd>{value(profile.nameEn)}</dd>
                <dt className="font-semibold">학번/사번</dt><dd>{value(profile.studentOrEmployeeNumber)}</dd>
                <dt className="font-semibold">KAIST UID</dt><dd>{value(profile.kaistUid)}</dd>
                <dt className="font-semibold">소속</dt><dd>{affiliationLabel(profile.majorMask)}</dd>
                <dt className="font-semibold">과비 납부</dt><dd>{feeLabel[profile.feeStatus]}</dd>
                <dt className="font-semibold">개인정보 저장 동의</dt>
                <dd>{profile.privacyConsentAt ? `동의 완료 (${new Date(profile.privacyConsentAt).toLocaleDateString('ko-KR')})` : '미동의'}</dd>
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
              {surveyError ? <p role="alert" className="mt-4 text-sm text-red-600">설문 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
              {!surveyError && surveyResponses === null ? <p role="status" className="mt-4 text-sm">설문 응답을 불러오는 중입니다.</p> : null}
              {!surveyError && surveyResponses?.length === 0 ? <p className="mt-4 text-sm">제출한 설문 응답이 없습니다.</p> : null}
              {surveyResponses && surveyResponses.length > 0 ? (
                <ul className="mt-4 divide-y">
                  {surveyResponses.map(({ survey, response }) => (
                    <li key={response.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <Link className="font-semibold underline" to={`/survey/${survey.id}`}>{survey.title.value}</Link>
                      <span className="text-sm">{responseStateLabel[response.state] ?? '상태 확인 중'} · {response.submittedAt ? new Date(response.submittedAt).toLocaleString('ko-KR') : '제출 전'}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </SiteLayout>
  );
}
