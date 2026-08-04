import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { hasGlobalGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { useLocale } from '@/lib/locale-store';
import { surveyApi } from '@/lib/survey-api';
import type { AdminSurveyResponseDetail, AdminSurveyResponsePage, SurveyDto } from '@soc/contracts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

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
  const materialize = async () => { if (!canManage || !survey || !location.trim() || busy) return; setBusy(true); setEventLink(''); setSurveyError(''); try { const result = await surveyApi.materializeEvent(surveyId, { location: location.trim(), visibility: 'PUBLIC' }); setEventLink(`/events/${result.eventId}`); setLocation(''); } catch { setSurveyError(uiText('ops.materializeError')); } finally { setBusy(false); } };
  const exportResponses = async () => { if (!canReview || busy) return; setBusy(true); setExportOutcome(''); try { await surveyApi.export(surveyId, { format: 'CSV', locale }); setExportOutcome(uiText('ops.exportStarted')); } catch { setExportOutcome(uiText('ops.exportFailed')); } finally { setBusy(false); } };
  useEffect(() => { if (detail) document.getElementById('response-detail')?.focus(); }, [detail]);
  useEffect(() => { if (reviewOutcome) outcomeStatus.current?.focus(); }, [reviewOutcome]);
  useEffect(() => { if (detailError) detailErrorStatus.current?.focus(); }, [detailError]);
  return <section className="space-y-6"><h1 className="text-[32px] font-extrabold">{uiText('ops.title')}</h1>
    {canReview && <><section aria-labelledby="responses-heading" className="rounded bg-white p-5 shadow"><h2 id="responses-heading" className="text-xl font-bold">{uiText('ops.responses')} {page ? `(${page.matchingCount})` : ''}</h2><label>{uiText('ops.status')} <select className="min-h-11" value={state} onChange={(event) => changePage({ state: event.target.value as State })}>{states.map((item) => <option key={item} value={item}>{stateLabel(item)}</option>)}</select></label><button className="min-h-11 px-3" disabled={busy} onClick={exportResponses}>{uiText('ops.export')}</button>{exportOutcome && <p role="status">{exportOutcome}</p>}{reviewOutcome && <p ref={outcomeStatus} role="status" tabIndex={-1}>{reviewOutcome}</p>}{pageError && <p role="alert">{pageError} <button className="min-h-11 px-3" onClick={load}>{uiText('ops.retry')}</button> <button className="min-h-11 px-3" onClick={resetPage}>{uiText('ops.reset')}</button></p>}<div aria-label={uiText('ops.responseScroller')} className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{uiText('ops.submitted')}</th><th>{uiText('ops.status')}</th><th>{uiText('ops.action')}</th></tr></thead><tbody>{page?.items.map((item) => <tr key={item.responseId} aria-selected={detail?.responseId === item.responseId} aria-describedby={detail?.responseId === item.responseId ? 'response-detail' : undefined} className={detail?.responseId === item.responseId ? 'bg-slate-100' : ''}><td>{new Date(item.submittedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}</td><td>{stateLabel(item.state)}</td><td><button className="min-h-11 px-3" onClick={() => open(item.responseId)}>{uiText('ops.open')}</button></td></tr>)}</tbody></table></div>{page?.nextCursor ? <button className="min-h-11 px-3" onClick={() => changePage({ cursor: page.nextCursor! })}>{uiText('ops.next')}</button> : cursor && <button className="min-h-11 px-3" onClick={resetPage}>{uiText('ops.firstPage')}</button>}{detailError && <p ref={detailErrorStatus} role="alert" tabIndex={-1}>{detailError} {detailRetryId && <button className="min-h-11 px-3" onClick={() => open(detailRetryId)}>{uiText('ops.retry')}</button>}</p>}</section>
    <section className="rounded bg-white p-5 shadow"><h2>{uiText('ops.aggregate')}</h2>{aggregateError && <p role="alert">{aggregateError} <button className="min-h-11 px-3" onClick={loadAggregate}>{uiText('ops.retry')}</button></p>}{aggregate && <><p>정확 집계 V2</p>{aggregate.revisions.map((revision) => <div key={revision.surveyRevisionId}><h3>{uiText('ops.revision')} {revision.revision}: {revision.responseCount}</h3>{revision.questions.map((question) => <div key={question.questionId}><strong>{label(question.prompt, uiText('ops.unavailable'))}</strong>: {question.responseCount}{question.choices.map((choice) => <span key={choice.choiceOptionId}> · {label(choice.label, uiText('ops.unavailable'))}: {choice.count}</span>)}</div>)}</div>)}</>}</section>
    {detail && <section id="response-detail" tabIndex={-1} className="rounded bg-white p-5 shadow" aria-live="polite"><h2>{uiText('ops.detail')}</h2>{detail.answers.map((answer) => <p key={answer.questionId}><strong>{label(answer.prompt, uiText('ops.unavailable'))}</strong>: {answer.value.kind === 'choices' ? answer.value.choices.map((choice) => label(choice.label, uiText('ops.unavailable'))).join(', ') : answer.value.kind === 'text' ? answer.value.textValue : answer.value.kind === 'number' ? answer.value.numberValue : answer.value.dateValue}</p>)}{detail.state === 'SUBMITTED' && <div><label>{uiText('ops.reason')}<textarea className="min-h-11" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label><p>{reason.trim().length}/500</p>{(['APPROVED', 'WAITLISTED', 'REJECTED'] as const).map((outcome) => <button className="min-h-11 px-3" key={outcome} disabled={busy || (outcome === 'REJECTED' && (!reason.trim() || reason.trim().length > 500))} onClick={() => setPending(outcome)}>{reviewOutcomeLabel(outcome)}</button>)}</div>}</section>}</>}
    {canManage && <section className="rounded bg-white p-5 shadow"><h2>{uiText('ops.materialize')}</h2><p>{uiText('ops.publicWarning')}</p>{surveyError && <p role="alert">{surveyError}</p>}<label>{uiText('ops.location')}<input className="min-h-11" value={location} onChange={(event) => setLocation(event.target.value)} /></label><button className="min-h-11 px-3" disabled={!survey || !location.trim() || busy} onClick={() => setMaterializeConfirm(true)}>{uiText('ops.materialize')}</button>{eventLink && <a className="inline-flex min-h-11 items-center px-3" href={eventLink}>{uiText('ops.openEvent')}</a>}</section>}
    <ConfirmationDialog open={materializeConfirm} title={uiText('ops.materialize')} description={survey ? uiFormat('ops.publicMaterializeDescription', [label(survey.title, uiText('ops.unavailable')), survey.opensAt ?? '-', survey.closesAt ?? '-', location.trim()]) : uiText('ops.publicWarning')} confirmLabel={uiText('ops.confirm')} cancelLabel={uiText('ops.cancel')} busy={busy} onCancel={() => setMaterializeConfirm(false)} onConfirm={async () => { await materialize(); setMaterializeConfirm(false); }} />
    <ConfirmationDialog open={pending !== null} title={pending ? uiFormat('ops.reviewConfirmTitle', [reviewOutcomeLabel(pending), detail?.responseId ?? '-', String(detail?.revision ?? '-')]) : ''} description={pending ? uiFormat('ops.reviewConfirmDescription', [reviewOutcomeLabel(pending), pending === 'REJECTED' ? reason.trim() : uiText('ops.noReason')]) : undefined} confirmLabel={uiText('ops.confirm')} cancelLabel={uiText('ops.cancel')} busy={busy} destructive={pending === 'REJECTED'} onCancel={() => setPending(null)} onConfirm={confirmReview} />
  </section>;
}
