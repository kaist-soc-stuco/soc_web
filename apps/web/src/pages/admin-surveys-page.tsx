import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { useLocale } from '@/lib/locale-store';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyDto, SurveyReviewQueueItem } from '@soc/contracts';
import { SurveyApiError, surveyApi } from '@/lib/survey-api';
import { hasGlobalGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';
const surveyStateLabels = {
    DRAFT: 'survey.state.DRAFT',
    SCHEDULED: 'survey.state.SCHEDULED',
    OPEN: 'survey.state.OPEN',
    CLOSED: 'survey.state.CLOSED',
    ARCHIVED: 'survey.state.ARCHIVED',
} as const;

export function AdminSurveysPage() {
    const [locale] = useLocale();
    const [items, setItems] = useState<SurveyDto[]>([]);
    const [queue, setQueue] = useState<SurveyReviewQueueItem[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const grants = useAdminGrants();
    const canManage = grants.status === 'ready' && hasGlobalGrant(grants.grants, 'SURVEY_MANAGE');
    const canReview = grants.status === 'ready' && hasGlobalGrant(grants.grants, 'SURVEY_REVIEW');
    const retry = useCallback(() => setReload((value) => value + 1), []);
    useEffect(() => {
        if (grants.status !== 'ready') return;
        const controller = new AbortController();
        let active = true;
        setStatus('loading'); setError(''); setItems([]); setQueue([]);
        const message = (cause: unknown) => cause instanceof SurveyApiError && cause.status === 401 ? uiText('pages.admin-surveys-page.2143060fb5') : cause instanceof TypeError ? uiText('pages.admin-surveys-page.883d591e09') : uiText('pages.admin-surveys-page.1aa2f8c99e');
        const requests: Promise<void>[] = [];
        if (canManage) requests.push(surveyApi.listAdmin(controller.signal, locale).then((result) => { if (active) setItems(result.items); }));
        if (canReview) requests.push(surveyApi.reviewQueue(controller.signal, locale).then((result) => { if (active) setQueue(result.items); }));
        void Promise.allSettled(requests).then((results) => {
            if (!active) return;
            const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected' && !(result.reason instanceof DOMException && result.reason.name === 'AbortError'));
            if (failures.length === requests.length && requests.length > 0) {
                setStatus('error');
                setError(message(failures[0].reason));
                return;
            }
            setStatus('ready');
            if (failures.length > 0) setError(message(failures[0].reason));
        });
        return () => { active = false; controller.abort(); };
    }, [canManage, canReview, grants.status, locale, reload]);
    const dateTime = (value: string) => new Date(value).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
    return <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-kaist-grey/25 pb-4"><div><h1 className="text-[32px] font-extrabold">{uiText('pages.admin-surveys-page.bfa15aa4f4')}</h1><p className="text-sm text-slate-600">{uiText(canManage && canReview ? 'surveyList.manageReview' : canManage ? 'surveyList.manage' : canReview ? 'surveyList.review' : 'surveyList.denied')}</p></div>{canManage && <Link to="/admin/surveys/new/edit" className="inline-flex min-h-11 items-center rounded bg-kaist-darkgreen-main px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen-main focus:ring-offset-2">{uiText('pages.admin-surveys-page.24122c8060')}</Link>}</div>{grants.status === 'loading' || grants.status === 'idle' ? <p role="status">{uiText('admin.grants.loading')}</p> : grants.status === 'error' ? <p role="alert" className="text-red-600">{uiText('admin.grants.error')}</p> : !canManage && !canReview ? <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">{uiText('surveyList.denied')}</p> : <>{error && <div role="alert" className="text-red-600"><p>{error}</p><button type="button" className="mt-2 min-h-11 px-3" onClick={retry}>{uiText('admin.retry')}</button></div>}{status === 'loading' && <p role="status">{uiText('pages.admin-surveys-page.6276e90dc1')}</p>}{status === 'ready' && canManage && <section aria-labelledby="managed-surveys"><h2 id="managed-surveys">{uiText('surveyList.managed')}</h2>{items.length === 0 ? <p>{uiText('pages.admin-surveys-page.8d47845831')}</p> : <div className="space-y-3">{items.map((survey) => <article key={survey.id} className="rounded bg-white p-5 shadow sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"><div><h3 className="font-semibold">{survey.title.value ?? ''}</h3><p className="text-sm text-slate-600">{uiText(surveyStateLabels[survey.state])}{survey.updatedAt && <> · {dateTime(survey.updatedAt)}</>}</p></div><div className="mt-3 flex flex-wrap gap-3 sm:mt-0"><Link className="inline-flex min-h-11 items-center font-medium text-kaist-darkgreen-main underline-offset-4 hover:underline" to={`/admin/surveys/${survey.id}/edit`}>{uiText('pages.admin-surveys-page.d482e14b40')}</Link><Link className="inline-flex min-h-11 items-center font-medium text-kaist-darkgreen-main underline-offset-4 hover:underline" to={`/admin/surveys/${survey.id}/responses`}>{uiText('pages.admin-surveys-page.89f631d48f')}</Link></div></article>)}</div>}</section>}{status === 'ready' && canReview && <section aria-labelledby="review-surveys"><h2 id="review-surveys">{uiText('surveyList.reviewQueue')}</h2>{queue.length === 0 ? <p>{uiText('surveyList.queueEmpty')}</p> : <div className="space-y-3">{queue.map((survey) => <article key={survey.surveyId} className="rounded bg-white p-5 shadow"><h3 className="font-semibold">{survey.title.value ?? ''}</h3><p className="text-sm text-slate-600">{uiText(surveyStateLabels[survey.state])} · {uiFormat('surveyList.responseCount', [survey.responseCount])}</p><Link className="inline-flex min-h-11 items-center font-medium text-kaist-darkgreen-main underline-offset-4 hover:underline" to={`/admin/surveys/${survey.surveyId}/responses`}>{uiText('pages.admin-surveys-page.89f631d48f')}</Link></article>)}</div>}</section>}</>}</section>;
}
