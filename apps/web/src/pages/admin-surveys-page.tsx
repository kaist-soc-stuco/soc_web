import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { useLocale } from '@/lib/locale-store';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyDto, SurveyReviewQueueItem } from '@soc/contracts';
import { CalendarDays, ClipboardCheck, FilePenLine, Plus, Users } from 'lucide-react';
import { SurveyApiError, surveyApi } from '@/lib/survey-api';
import { hasGlobalGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';
import { formatRecordDateTime, formatScheduleRange } from '@/lib/schedule-date';
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
    const actionClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-kaist-grey/25 px-3 py-2 text-sm font-extrabold text-kaist-darkgreen transition hover:border-kaist-darkgreen/30 hover:bg-kaist-lightgreen2/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/20';
    return <section>
      <header className="mb-6 flex flex-col gap-4 border-b border-kaist-grey/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-[28px] font-extrabold tracking-tight sm:text-[32px]">{uiText('pages.admin-surveys-page.bfa15aa4f4')}</h1><p className="mt-1 text-sm font-medium text-slate-600">{uiText(canManage && canReview ? 'surveyList.manageReview' : canManage ? 'surveyList.manage' : canReview ? 'surveyList.review' : 'surveyList.denied')}</p></div>
        {canManage && <Link to="/admin/surveys/new/edit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-kaist-darkgreen2 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen focus:ring-offset-2"><Plus className="h-4 w-4"/>{uiText('pages.admin-surveys-page.24122c8060')}</Link>}
      </header>

      {grants.status === 'loading' || grants.status === 'idle' ? <p role="status" className="rounded-xl border border-kaist-grey/20 bg-white p-6 text-center font-semibold text-kaist-grey">{uiText('admin.grants.loading')}</p>
      : grants.status === 'error' ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{uiText('admin.grants.error')}</p>
      : !canManage && !canReview ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{uiText('surveyList.denied')}</p>
      : <>
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><p>{error}</p><button type="button" className="mt-2 min-h-11 px-3 underline" onClick={retry}>{uiText('admin.retry')}</button></div>}
          {status === 'loading' && <p role="status" className="rounded-xl border border-kaist-grey/20 bg-white p-8 text-center font-semibold text-kaist-grey">{uiText('pages.admin-surveys-page.6276e90dc1')}</p>}

          {status === 'ready' && canManage && <section aria-labelledby="managed-surveys">
            <div className="mb-3 flex items-center gap-2"><FilePenLine className="h-5 w-5 text-kaist-darkgreen"/><h2 id="managed-surveys" className="text-xl font-extrabold text-kaist-black">{uiText('surveyList.managed')}</h2><span className="rounded-full bg-kaist-lightgreen2/20 px-2.5 py-1 text-xs font-bold text-kaist-darkgreen">{items.length}</span></div>
            {items.length === 0 ? <p className="rounded-2xl border border-dashed border-kaist-grey/30 bg-white p-10 text-center text-sm font-semibold text-kaist-grey">{uiText('pages.admin-surveys-page.8d47845831')}</p> : <div className="grid gap-4 xl:grid-cols-2">{items.map((survey) => {
              const schedule = formatScheduleRange(survey.opensAt, survey.closesAt, { includeTime: false });
              return <article key={survey.id} className="flex min-w-0 flex-col rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)] transition hover:border-kaist-darkgreen/20">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">{uiText(surveyStateLabels[survey.state])}</span><h3 className="mt-3 line-clamp-2 text-lg font-extrabold leading-snug text-kaist-black">{survey.title.value ?? ''}</h3></div><ClipboardCheck className="h-6 w-6 shrink-0 text-kaist-greygreen"/></div>
                <div className="mt-4 space-y-1.5 text-xs font-semibold text-kaist-grey">{schedule && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-kaist-darkgreen"/>{schedule}</p>}{survey.updatedAt && <p>{locale === 'ko' ? '최근 수정' : 'Updated'} · {formatRecordDateTime(survey.updatedAt)}</p>}</div>
                <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-kaist-grey/15 pt-4"><Link className={actionClass} to={`/admin/surveys/${survey.id}/edit`}><FilePenLine className="h-4 w-4"/>{uiText('pages.admin-surveys-page.d482e14b40')}</Link><Link className={actionClass} to={`/admin/surveys/${survey.id}/responses`}><Users className="h-4 w-4"/>{uiText('pages.admin-surveys-page.89f631d48f')}</Link></div>
              </article>;
            })}</div>}
          </section>}

          {status === 'ready' && canReview && <section aria-labelledby="review-surveys" className={canManage ? 'mt-8 border-t border-kaist-grey/20 pt-7' : ''}>
            <div className="mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-kaist-darkgreen"/><h2 id="review-surveys" className="text-xl font-extrabold text-kaist-black">{uiText('surveyList.reviewQueue')}</h2><span className="rounded-full bg-kaist-lightgreen2/20 px-2.5 py-1 text-xs font-bold text-kaist-darkgreen">{queue.length}</span></div>
            {queue.length === 0 ? <p className="rounded-2xl border border-dashed border-kaist-grey/30 bg-white p-8 text-center text-sm font-semibold text-kaist-grey">{uiText('surveyList.queueEmpty')}</p> : <div className="grid gap-3 xl:grid-cols-2">{queue.map((survey) => <article key={survey.surveyId} className="flex items-center justify-between gap-4 rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]"><div className="min-w-0"><h3 className="truncate font-extrabold text-kaist-black">{survey.title.value ?? ''}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{uiText(surveyStateLabels[survey.state])} · {uiFormat('surveyList.responseCount', [survey.responseCount])}</p></div><Link className={`${actionClass} shrink-0`} to={`/admin/surveys/${survey.surveyId}/responses`}>{uiText('pages.admin-surveys-page.89f631d48f')}</Link></article>)}</div>}
          </section>}
        </>}
    </section>;
}
