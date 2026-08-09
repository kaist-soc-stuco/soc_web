import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { hasGlobalGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { useLocale } from '@/lib/locale-store';
import { formatRecordDateTime, formatScheduleDateTime } from '@/lib/schedule-date';
import { surveyApi } from '@/lib/survey-api';
import type { AdminSurveyResponseDetail, AdminSurveyResponsePage, SurveyDto } from '@soc/contracts';
import { BarChart3, CalendarPlus, ChevronLeft, Download, FileText } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

const states = ['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'] as const;
type State = typeof states[number];
const label = (field: { value: string | null; translationUnavailable: boolean }, fallback: string) => field.value ?? fallback;
const protocolError = () => uiText('ops.protocolError');
const reviewOutcomeLabel = (outcome: 'APPROVED' | 'REJECTED' | 'WAITLISTED') => uiText(outcome === 'APPROVED' ? 'pages.admin-survey-operations-page.0d1cd67197' : outcome === 'REJECTED' ? 'pages.admin-survey-operations-page.d747407a52' : 'pages.admin-survey-operations-page.df72a8753d');
const stateLabel = (state: State) => state === 'SUBMITTED' ? uiText('survey.responseSubmitted') : reviewOutcomeLabel(state);
export function AdminSurveyOperationsPage() {
  const { surveyId = '' } = useParams<{ surveyId: string }>();
  const [locale] = useLocale();
  const [params, setParams] = useSearchParams();
  const grants = useAdminGrants();
  const canManage = grants.status === 'ready' && hasGlobalGrant(grants.grants, 'SURVEY_MANAGE');
  const canReview = grants.status === 'ready' && hasGlobalGrant(grants.grants, 'SURVEY_REVIEW');
  const state = states.includes(params.get('state') as State) ? params.get('state') as State : 'SUBMITTED';
  const cursor = params.get('cursor') ?? undefined;
  const [page, setPage] = useState<AdminSurveyResponsePage | null>(null);
  const [detail, setDetail] = useState<AdminSurveyResponseDetail | null>(null);
  const [survey, setSurvey] = useState<SurveyDto | null>(null);
  const [aggregate, setAggregate] = useState<Awaited<ReturnType<typeof surveyApi.aggregate>> | null>(null);
  const [pageError, setPageError] = useState(''); const [detailError, setDetailError] = useState(''); const [aggregateError, setAggregateError] = useState(''); const [surveyError, setSurveyError] = useState('');
  const [reason, setReason] = useState(''); const [pending, setPending] = useState<'APPROVED' | 'REJECTED' | 'WAITLISTED' | null>(null);
  const [busy, setBusy] = useState(false); const [location, setLocation] = useState(''); const [eventLink, setEventLink] = useState(''); const [exportOutcome, setExportOutcome] = useState(''); const [reviewOutcome, setReviewOutcome] = useState('');
  const [detailRetryId, setDetailRetryId] = useState<string | null>(null);
  const [materializeConfirm, setMaterializeConfirm] = useState(false);
  const pageToken = useRef(0); const detailToken = useRef(0); const pageController = useRef<AbortController | null>(null); const detailController = useRef<AbortController | null>(null); const outcomeStatus = useRef<HTMLParagraphElement | null>(null); const detailErrorStatus = useRef<HTMLParagraphElement | null>(null);
  const scope = `${surveyId}:${locale}:${state}:${cursor ?? ''}`;

  useLayoutEffect(() => { pageController.current?.abort(); ++pageToken.current; setPage(null); setPageError(''); detailController.current?.abort(); ++detailToken.current; setDetail(null); setReason(''); setPending(null); setDetailError(''); setDetailRetryId(null); setReviewOutcome(''); }, [scope]);
  const load = () => {
    pageController.current?.abort(); const controller = new AbortController(); pageController.current = controller; const current = ++pageToken.current;
    setPageError('');
    if (!canReview) { setPage(null); return () => controller.abort(); }
    void surveyApi.responses(surveyId, { state, limit: 25, cursor, locale }, controller.signal).then((value) => {
      if (current !== pageToken.current) return;
      if (value.surveyId !== surveyId || value.locale !== locale || value.state !== state) { setPage(null); setPageError(protocolError()); return; }
      setPage(value);
    }).catch((error) => { if (error.name !== 'AbortError' && current === pageToken.current) setPageError(uiText('ops.loadError')); });
    return () => controller.abort();
  };
  useEffect(load, [surveyId, state, cursor, locale, canReview]);
  const loadAggregate = () => {
    const controller = new AbortController(); setAggregateError('');
    if (!canReview) { setAggregate(null); return () => controller.abort(); }
    void surveyApi.aggregate(surveyId, locale, controller.signal).then((value) => {
      if (value.surveyId !== surveyId || value.locale !== locale) { setAggregate(null); setAggregateError(protocolError()); } else setAggregate(value);
    }).catch((error) => { if (error.name !== 'AbortError') setAggregateError(uiText('ops.loadError')); });
    return () => controller.abort();
  };
  useEffect(loadAggregate, [surveyId, locale, canReview]);
  useEffect(() => {
    if (!canManage) { setSurvey(null); setSurveyError(''); return; }
    const controller = new AbortController(); setSurveyError('');
    void surveyApi.get(surveyId, locale, controller.signal).then((value) => { if (value.id === surveyId && value.locale === locale) setSurvey(value); else { setSurvey(null); setSurveyError(protocolError()); } }).catch((error) => { if (error.name !== 'AbortError') setSurveyError(uiText('ops.loadError')); });
    return () => controller.abort();
  }, [surveyId, locale, canManage]);
  const clearDetail = (error = '', retryId: string | null = null) => { setDetail(null); setReason(''); setPending(null); setDetailError(error); setDetailRetryId(retryId); };
  const open = (responseId: string) => {
    detailController.current?.abort(); const controller = new AbortController(); detailController.current = controller; const current = ++detailToken.current;
    clearDetail(); setReviewOutcome('');
    void surveyApi.response(surveyId, responseId, locale, controller.signal).then((value) => {
      if (current !== detailToken.current) return;
      if (value.surveyId !== surveyId || value.responseId !== responseId || !value.surveyRevisionId || !Number.isInteger(value.revision) || value.locale !== locale) { clearDetail(protocolError(), responseId); return; }
      setDetail(value); setDetailRetryId(null);
    }).catch((error) => { if (error.name !== 'AbortError' && current === detailToken.current) clearDetail(uiText('ops.loadError'), responseId); });
  };
  const resetPage = () => { detailController.current?.abort(); ++detailToken.current; clearDetail(); setReviewOutcome(''); setParams({ state: 'SUBMITTED' }); };
  const changePage = (next: Partial<{ state: State; cursor: string }>) => { detailController.current?.abort(); ++detailToken.current; clearDetail(); setReviewOutcome(''); setParams({ state: next.state ?? state, ...(next.cursor ? { cursor: next.cursor } : {}) }); };
  const confirmReview = async () => {
    if (!canReview || !detail || !pending || busy) return;
    const target = detail; const outcome = pending; const trimmed = reason.trim();
    if (outcome === 'REJECTED' && (!trimmed || trimmed.length > 500)) return;
    setBusy(true); setDetailError('');
    try {
      const updated = await surveyApi.review(surveyId, target.responseId, locale, outcome === 'REJECTED' ? { expectedSurveyRevisionId: target.surveyRevisionId, state: outcome, reason: trimmed } : { expectedSurveyRevisionId: target.surveyRevisionId, state: outcome });
      if (updated.surveyId !== surveyId || updated.responseId !== target.responseId || updated.surveyRevisionId !== target.surveyRevisionId || !Number.isInteger(updated.revision) || updated.revision !== target.revision || updated.locale !== locale || updated.state !== outcome) { clearDetail(protocolError(), target.responseId); return; }
      clearDetail(); setReviewOutcome(reviewOutcomeLabel(outcome)); load(); loadAggregate();
    } catch { clearDetail(uiText('ops.reviewError'), target.responseId); } finally { setBusy(false); }
  };
  const materialize = async () => { if (!canManage || !survey || !location.trim() || busy) return; setBusy(true); setEventLink(''); setSurveyError(''); try { const result = await surveyApi.materializeEvent(surveyId, { location: location.trim(), visibility: 'PUBLIC' }); setEventLink(`/calendar?eventId=${encodeURIComponent(result.eventId)}`); setLocation(''); } catch { setSurveyError(uiText('ops.materializeError')); } finally { setBusy(false); } };
  const exportResponses = async () => { if (!canReview || busy) return; setBusy(true); setExportOutcome(''); try { await surveyApi.export(surveyId, { format: 'CSV', locale }); setExportOutcome(uiText('ops.exportStarted')); } catch { setExportOutcome(uiText('ops.exportFailed')); } finally { setBusy(false); } };
  useEffect(() => { if (detail) document.getElementById('response-detail')?.focus(); }, [detail]);
  useEffect(() => { if (reviewOutcome) outcomeStatus.current?.focus(); }, [reviewOutcome]);
  useEffect(() => { if (detailError) detailErrorStatus.current?.focus(); }, [detailError]);
  const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-kaist-grey/25 bg-white px-4 py-2 text-sm font-extrabold text-kaist-darkgreen transition hover:border-kaist-darkgreen/30 hover:bg-kaist-lightgreen2/10 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/20 disabled:cursor-not-allowed disabled:opacity-45';
  return <section className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-kaist-grey/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link to="/admin/surveys" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-kaist-greygreen hover:text-kaist-darkgreen"><ChevronLeft className="h-4 w-4"/>{locale === 'ko' ? '설문 목록' : 'Survey list'}</Link>
        <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[32px]">{uiText('ops.title')}</h1>
        <p className="mt-1 text-sm font-medium text-kaist-grey">{locale === 'ko' ? '응답 검토, 결과 집계와 공개 행사 전환을 한 화면에서 관리합니다.' : 'Review responses, inspect results, and create a public event.'}</p>
      </div>
    </header>

    {canReview && <>
      <section aria-labelledby="responses-heading" className="overflow-hidden rounded-2xl border border-kaist-grey/20 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 border-b border-kaist-grey/15 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="responses-heading" className="text-xl font-extrabold text-kaist-black">{uiText('ops.responses')} {page ? <span className="text-kaist-darkgreen">({page.matchingCount})</span> : ''}</h2><p className="mt-1 text-sm text-kaist-grey">{locale === 'ko' ? '상태별 응답을 선택해 상세 내용을 검토합니다.' : 'Filter responses by status and review their details.'}</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-bold text-kaist-grey">{uiText('ops.status')}<select className="min-h-11 rounded-xl border border-kaist-grey/25 bg-white px-3 text-sm font-bold text-kaist-black outline-none focus:border-kaist-darkgreen" value={state} onChange={(event) => changePage({ state: event.target.value as State })}>{states.map((item) => <option key={item} value={item}>{stateLabel(item)}</option>)}</select></label>
            <button className={buttonClass} disabled={busy} onClick={exportResponses}><Download className="mr-2 h-4 w-4"/>{uiText('ops.export')}</button>
          </div>
        </div>
        {exportOutcome && <p role="status" className="mx-5 mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-kaist-grey">{exportOutcome}</p>}
        {reviewOutcome && <p ref={outcomeStatus} role="status" tabIndex={-1} className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{reviewOutcome}</p>}
        {pageError && <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{pageError} <button className="min-h-11 px-3 underline" onClick={load}>{uiText('ops.retry')}</button> <button className="min-h-11 px-3 underline" onClick={resetPage}>{uiText('ops.reset')}</button></p>}
        <div aria-label={uiText('ops.responseScroller')} className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="border-b border-kaist-grey/15 bg-slate-50/80 text-xs font-extrabold uppercase tracking-wide text-kaist-grey"><tr><th className="px-5 py-4">{uiText('ops.submitted')}</th><th className="px-5 py-4">{uiText('ops.status')}</th><th className="px-5 py-4 text-right">{uiText('ops.action')}</th></tr></thead>
            <tbody className="divide-y divide-kaist-grey/10">{page?.items.map((item) => <tr key={item.responseId} aria-selected={detail?.responseId === item.responseId} aria-describedby={detail?.responseId === item.responseId ? 'response-detail' : undefined} className={detail?.responseId === item.responseId ? 'bg-kaist-lightgreen2/15' : 'transition hover:bg-slate-50/70'}><td className="whitespace-nowrap px-5 py-3 font-semibold text-kaist-black">{formatRecordDateTime(item.submittedAt)}</td><td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stateLabel(item.state)}</span></td><td className="px-5 py-3 text-right"><button className={`${buttonClass} px-3`} onClick={() => open(item.responseId)}>{uiText('ops.open')}</button></td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-kaist-grey/10 p-4">{page?.nextCursor ? <button className={buttonClass} onClick={() => changePage({ cursor: page.nextCursor! })}>{uiText('ops.next')}</button> : cursor && <button className={buttonClass} onClick={resetPage}>{uiText('ops.firstPage')}</button>}</div>
        {detailError && <p ref={detailErrorStatus} role="alert" tabIndex={-1} className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{detailError} {detailRetryId && <button className="min-h-11 px-3 underline" onClick={() => open(detailRetryId)}>{uiText('ops.retry')}</button>}</p>}
      </section>

      <section className="rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-kaist-black"><BarChart3 className="h-5 w-5 text-kaist-darkgreen"/>{uiText('ops.aggregate')}</h2>
        {aggregateError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{aggregateError} <button className="min-h-11 px-3 underline" onClick={loadAggregate}>{uiText('ops.retry')}</button></p>}
        {aggregate && <div className="mt-4 space-y-4">{aggregate.revisions.map((revision) => <article key={revision.surveyRevisionId} className="rounded-xl border border-kaist-grey/15 bg-slate-50/50 p-4"><h3 className="font-extrabold text-kaist-black">{uiText('ops.revision')} {revision.revision} · {revision.responseCount}</h3><div className="mt-3 space-y-3">{revision.questions.map((question) => <div key={question.questionId} className="rounded-lg bg-white p-3"><strong className="text-sm text-kaist-black">{label(question.prompt, uiText('ops.unavailable'))}</strong><span className="ml-2 text-xs font-bold text-kaist-grey">{question.responseCount}</span>{question.choices.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{question.choices.map((choice) => <span key={choice.choiceOptionId} className="rounded-full bg-kaist-lightgreen2/20 px-2.5 py-1 text-xs font-bold text-kaist-darkgreen">{label(choice.label, uiText('ops.unavailable'))}: {choice.count}</span>)}</div>}</div>)}</div></article>)}</div>}
      </section>

      {detail && <section id="response-detail" tabIndex={-1} className="rounded-2xl border border-kaist-darkgreen/20 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen/20" aria-live="polite"><h2 className="flex items-center gap-2 text-xl font-extrabold text-kaist-black"><FileText className="h-5 w-5 text-kaist-darkgreen"/>{uiText('ops.detail')}</h2><div className="mt-4 space-y-3">{detail.answers.map((answer) => <div key={answer.questionId} className="rounded-xl border border-kaist-grey/15 bg-slate-50/60 p-4"><strong className="block text-sm text-kaist-black">{label(answer.prompt, uiText('ops.unavailable'))}</strong><p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-700">{answer.value.kind === 'choices' ? answer.value.choices.map((choice) => label(choice.label, uiText('ops.unavailable'))).join(', ') : answer.value.kind === 'text' ? answer.value.textValue : answer.value.kind === 'number' ? answer.value.numberValue : answer.value.dateValue}</p></div>)}</div>{detail.state === 'SUBMITTED' && <div className="mt-5 border-t border-kaist-grey/15 pt-5"><label className="grid gap-2 text-sm font-extrabold text-kaist-black">{uiText('ops.reason')}<textarea className="min-h-24 w-full rounded-xl border border-kaist-grey/25 p-3 text-sm font-medium outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)}/></label><p className="mt-1 text-right text-xs font-bold text-kaist-grey">{reason.trim().length}/500</p><div className="mt-3 flex flex-wrap justify-end gap-2">{(['APPROVED', 'WAITLISTED', 'REJECTED'] as const).map((outcome) => <button className={buttonClass} key={outcome} disabled={busy || (outcome === 'REJECTED' && (!reason.trim() || reason.trim().length > 500))} onClick={() => setPending(outcome)}>{reviewOutcomeLabel(outcome)}</button>)}</div></div>}</section>}
    </>}

    {canManage && <section className="rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]"><h2 className="flex items-center gap-2 text-xl font-extrabold text-kaist-black"><CalendarPlus className="h-5 w-5 text-kaist-darkgreen"/>{uiText('ops.materialize')}</h2><p className="mt-2 text-sm font-medium text-kaist-grey">{uiText('ops.publicWarning')}</p>{surveyError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{surveyError}</p>}<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-sm font-extrabold text-kaist-black">{uiText('ops.location')}<input className="min-h-11 rounded-xl border border-kaist-grey/25 px-4 text-sm font-medium outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15" value={location} onChange={(event) => setLocation(event.target.value)}/></label><button className={`${buttonClass} border-kaist-darkgreen bg-kaist-darkgreen text-white hover:bg-kaist-darkgreen2`} disabled={!survey || !location.trim() || busy} onClick={() => setMaterializeConfirm(true)}>{uiText('ops.materialize')}</button>{eventLink && <Link className={buttonClass} to={eventLink}>{uiText('ops.openEvent')}</Link>}</div></section>}
    <ConfirmationDialog open={materializeConfirm} title={uiText('ops.materialize')} description={survey ? uiFormat('ops.publicMaterializeDescription', [label(survey.title, uiText('ops.unavailable')), survey.opensAt ? formatScheduleDateTime(survey.opensAt) : '-', survey.closesAt ? formatScheduleDateTime(survey.closesAt) : '-', location.trim()]) : uiText('ops.publicWarning')} confirmLabel={uiText('ops.confirm')} cancelLabel={uiText('ops.cancel')} busy={busy} onCancel={() => setMaterializeConfirm(false)} onConfirm={async () => { await materialize(); setMaterializeConfirm(false); }} />
    <ConfirmationDialog open={pending !== null} title={pending ? uiFormat('ops.reviewConfirmTitle', [reviewOutcomeLabel(pending), detail?.responseId ?? '-', String(detail?.revision ?? '-')]) : ''} description={pending ? uiFormat('ops.reviewConfirmDescription', [reviewOutcomeLabel(pending), pending === 'REJECTED' ? reason.trim() : uiText('ops.noReason')]) : undefined} confirmLabel={uiText('ops.confirm')} cancelLabel={uiText('ops.cancel')} busy={busy} destructive={pending === 'REJECTED'} onCancel={() => setPending(null)} onConfirm={confirmReview} />
  </section>;
}
