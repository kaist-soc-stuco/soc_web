import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { MySurveyResponsesResponse, UserMeResponse } from '@soc/contracts';
import { Link } from 'react-router-dom';

import { SiteLayout } from '@/components/organisms/site-layout';
import { profileApi, ProfileApiError } from '@/lib/profile-api';
import { surveyApi } from '@/lib/survey-api';
import { getLocaleGeneration, useLocale } from '@/lib/locale-store';
import { catalog } from '@/lib/i18n/catalog';

const value = (input: string | null) => input || '-';

export function MyPage() {
  const [locale] = useLocale();
  const copy = catalog[locale].mypage;
  const feeLabel = { PAID: copy.paid, UNPAID: copy.unpaid, UNKNOWN: copy.unknown } as const;
  const responseStateLabel: Record<string, string> = { DRAFT: copy.draft, SUBMITTED: copy.submitted, APPROVED: copy.approved, REJECTED: copy.rejected, WAITLISTED: copy.waitlisted };
  const affiliationLabel = (mask: number) => mask === 0 ? copy.noAffiliation : mask === 1 ? copy.soc : `${copy.multipleAffiliations} (${mask})`;
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<MySurveyResponsesResponse['items'] | null>(null);
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [surveyError, setSurveyError] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    const capturedGeneration = getLocaleGeneration();
    setStatus('loading');
    setMessage('');
    setSurveyError(false);
    setSurveyResponses(null);
    void profileApi.get(signal).then((loaded) => {
      if (capturedGeneration !== getLocaleGeneration()) return;
      setProfile(loaded);
      void surveyApi.mineAll(locale, signal)
        .then((surveys) => {
          if (capturedGeneration === getLocaleGeneration() && surveys.locale === locale) setSurveyResponses(surveys.items);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          if (capturedGeneration === getLocaleGeneration()) setSurveyError(true);
        });
      setMobile(loaded.userMobile ?? '');
      setStatus('ready');
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (capturedGeneration !== getLocaleGeneration()) return;
      setProfile(null);
      setMessage(cause instanceof ProfileApiError && cause.status === 401 ? copy.loginRequired : copy.loadProfileFailed);
      setStatus('error');
    });
  }, [copy.loadProfileFailed, copy.loginRequired, locale]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const capturedGeneration = getLocaleGeneration();
    setStatus('saving');
    setMessage('');
    try {
      const updated = await profileApi.update({ userMobile: mobile.trim() || null });
      if (capturedGeneration !== getLocaleGeneration()) return;
      setProfile(updated);
      setMobile(updated.userMobile ?? '');
      setMessage(copy.saved);
      setStatus('ready');
    } catch {
      if (capturedGeneration !== getLocaleGeneration()) return;
      setMessage(copy.saveFailed);
      setStatus('ready');
    }
  };

  return (
    <SiteLayout>
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-4xl px-6 py-12">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">{copy.title}</h1>
        {status === 'loading' ? <p role="status" className="mt-8">{copy.loadingProfile}</p> : null}
        {status === 'error' ? (
          <div role="alert" className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{message}</p>
            <div className="mt-3 flex gap-4">
              {message === copy.loginRequired ? <Link className="font-bold underline" to="/login">{copy.login}</Link> : <button type="button" className="font-bold underline" onClick={() => load()}>{copy.retry}</button>}
              <Link className="font-bold underline" to="/">{copy.home}</Link>
            </div>
          </div>
        ) : null}
        {profile ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-kaist-grey/25 bg-white p-6">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">{copy.basic}</h2>
              <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
                <dt className="font-semibold">{copy.nameKr}</dt><dd>{value(profile.nameKr)}</dd>
                <dt className="font-semibold">{copy.nameEn}</dt><dd>{value(profile.nameEn)}</dd>
                <dt className="font-semibold">{copy.number}</dt><dd>{value(profile.studentOrEmployeeNumber)}</dd>
                <dt className="font-semibold">KAIST UID</dt><dd>{value(profile.kaistUid)}</dd>
                <dt className="font-semibold">{copy.affiliation}</dt><dd>{affiliationLabel(profile.majorMask)}</dd>
                <dt className="font-semibold">{copy.fee}</dt><dd>{feeLabel[profile.feeStatus]}</dd>
                <dt className="font-semibold">{copy.consent}</dt>
                <dd>{profile.privacyConsentAt ? `${copy.agreed} (${new Date(profile.privacyConsentAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')})` : copy.notAgreed}</dd>
              </dl>
            </section>
            <form onSubmit={submit} className="rounded-lg border border-kaist-grey/25 bg-white p-6">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">{copy.contact}</h2>
              <label className="mt-5 block text-sm font-semibold" htmlFor="mypage-email">{copy.email}</label>
              <input id="mypage-email" type="email" value={profile.userEmail ?? ''} readOnly aria-readonly="true" className="mt-2 w-full rounded border border-kaist-grey/40 bg-kaist-grey/10 px-3 py-2" />
              <label className="mt-4 block text-sm font-semibold" htmlFor="mypage-mobile">{copy.mobile}</label>
              <input id="mypage-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} className="mt-2 w-full rounded border border-kaist-grey/40 px-3 py-2" />
              <button type="submit" disabled={status === 'saving'} className="mt-5 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-60">{status === 'saving' ? copy.saving : copy.save}</button>
              {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
            </form>
            <section className="rounded-lg border border-kaist-grey/25 bg-white p-6 md:col-span-2">
              <h2 className="text-xl font-extrabold text-kaist-darkgreen">{copy.surveys}</h2>
              {surveyError ? <p role="alert" className="mt-4 text-sm text-red-600">{copy.loadSurveysFailed}</p> : null}
              {!surveyError && surveyResponses === null ? <p role="status" className="mt-4 text-sm">{copy.loadingSurveys}</p> : null}
              {!surveyError && surveyResponses?.length === 0 ? <p className="mt-4 text-sm">{copy.noSurveys}</p> : null}
              {surveyResponses && surveyResponses.length > 0 ? (
                <ul className="mt-4 divide-y">
                  {surveyResponses.map(({ survey, response }) => (
                    <li key={response.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <Link className="font-semibold underline" to={`/survey/${survey.id}`}>{survey.title.translationUnavailable ? copy.unavailable : survey.title.value}</Link>
                      <span className="text-sm">{responseStateLabel[response.state] ?? copy.unknown} · {response.submittedAt ? new Date(response.submittedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US') : copy.draft}</span>
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
