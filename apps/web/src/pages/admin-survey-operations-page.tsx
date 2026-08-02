import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AdminSurveyResponseListItem, ContentMatcherDto, EventItem, SurveyAggregateResponse, SurveyResponseDto } from '@soc/contracts';
import { adminEventApi } from '@/lib/admin-event-api';
import { surveyApi } from '@/lib/survey-api';
export function AdminSurveyOperationsPage() {
    const { surveyId = '' } = useParams<{
        surveyId: string;
    }>();
    const [responses, setResponses] = useState<AdminSurveyResponseListItem[]>([]);
    const [aggregate, setAggregate] = useState<SurveyAggregateResponse | null>(null);
    const [selected, setSelected] = useState<SurveyResponseDto | null>(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [relations, setRelations] = useState<ContentMatcherDto[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [eventId, setEventId] = useState('');
    const [synchronize, setSynchronize] = useState(false);
    const [relationBusy, setRelationBusy] = useState(false);
    const [materializeLocation, setMaterializeLocation] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        void Promise.all([surveyApi.responses(surveyId, controller.signal), surveyApi.aggregate(surveyId), surveyApi.relations({ surveyId }, controller.signal), adminEventApi.list()])
            .then(([list, analysis, related, eventList]) => { setResponses(list.items); setAggregate(analysis); setRelations(related.items); setEvents(eventList.items); })
            .catch(() => setError(uiText("pages.admin-survey-operations-page.ccca9796cc")));
        return () => controller.abort();
    }, [surveyId]);
    const open = async (id: string) => setSelected(await surveyApi.response(id));
    const review = async (state: 'APPROVED' | 'REJECTED' | 'WAITLISTED') => {
        if (!selected)
            return;
        const updated = await surveyApi.review(selected.id, state === 'REJECTED' ? { state, reason } : { state });
        setSelected(updated);
        setResponses((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated, surveyId: item.surveyId } : item));
    };
    const linkEvent = async () => {
        if (!eventId || relationBusy)
            return;
        setRelationBusy(true);
        setError('');
        try {
            const relation = await surveyApi.createRelation({ eventId, surveyId, relationType: 'SURVEY_PERIOD', syncMode: synchronize ? 'SURVEY_TO_EVENT' : 'NONE' });
            setRelations((items) => [relation, ...items]);
            setEventId('');
            setSynchronize(false);
        }
        catch {
            setError(uiText("pages.admin-survey-operations-page.b3294dd8b9"));
        }
        finally {
            setRelationBusy(false);
        }
    };
    const unlink = async (relation: ContentMatcherDto) => {
        if (relationBusy)
            return;
        setRelationBusy(true);
        setError('');
        try {
            await surveyApi.deleteRelation(relation.id);
            setRelations((items) => items.filter((item) => item.id !== relation.id));
        }
        catch {
            setError(uiText("pages.admin-survey-operations-page.ead155a9db"));
        }
        finally {
            setRelationBusy(false);
        }
    };
    const materialize = async () => {
        if (!materializeLocation.trim() || relationBusy)
            return;
        setRelationBusy(true);
        setError('');
        try {
            const result = await surveyApi.materializeEvent(surveyId, { location: materializeLocation.trim(), visibility: 'PUBLIC' });
            setRelations((items) => [result.relation, ...items]);
            setMaterializeLocation('');
            const eventList = await adminEventApi.list();
            setEvents(eventList.items);
        }
        catch {
            setError(uiText("pages.admin-survey-operations-page.ab3de4b6d9"));
        }
        finally {
            setRelationBusy(false);
        }
    };
    return <section><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-survey-operations-page.60017e2c2e")}</h1>{error && <p role="alert">{error}</p>}
    <div className="my-5 flex gap-3"><button className="rounded bg-kaist-darkgreen px-4 py-2 text-white" onClick={() => void surveyApi.export(surveyId, { format: 'CSV' })}>{uiText("pages.admin-survey-operations-page.8f1bcdcc42")}</button><strong>{uiText("pages.admin-survey-operations-page.1b3257099f")}{aggregate?.suppressed ? uiText("pages.admin-survey-operations-page.f4285ed157") : aggregate?.responseCount ?? '-'}</strong></div>
    {aggregate && <section className="mb-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">{uiText("pages.admin-survey-operations-page.dbe0d28726")}</h2>{aggregate.questions.map((question) => <div key={question.questionId} className="mt-3">{question.questionId}: {question.suppressed ? uiText("pages.admin-survey-operations-page.331c680ab2") : question.responseCount}{question.choices.map((choice) => <span key={choice.choiceOptionId} className="ml-3">{choice.choiceOptionId}: {choice.count}</span>)}</div>)}</section>}
    <section className="mb-6 rounded bg-white p-5 shadow">
      <h2 className="text-xl font-bold">{uiText("pages.admin-survey-operations-page.e6dfe5a7d3")}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1">{uiText("pages.admin-survey-operations-page.6d49bc5a5e")}<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="border px-2 py-1"><option value="">{uiText("pages.admin-survey-operations-page.1966b543e4")}</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title.value ?? event.id}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={synchronize} onChange={(event) => setSynchronize(event.target.checked)}/>{uiText("pages.admin-survey-operations-page.b79e3d9ca2")}</label>
        <button disabled={!eventId || relationBusy} onClick={() => void linkEvent()} className="rounded bg-kaist-darkgreen px-3 py-2 text-white disabled:opacity-50">{uiText("pages.admin-survey-operations-page.52b7ec5f76")}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><label className="grid gap-1">{uiText("pages.admin-survey-operations-page.b8ad6e59be")}<input value={materializeLocation} onChange={(event) => setMaterializeLocation(event.target.value)} className="border px-2 py-1"/></label><button disabled={!materializeLocation.trim() || relationBusy} onClick={() => void materialize()} className="rounded border border-kaist-darkgreen px-3 py-2 text-kaist-darkgreen disabled:opacity-50">{uiText("pages.admin-survey-operations-page.a2ab7e2049")}</button></div>
      {relations.length === 0 ? <p className="mt-3 text-slate-600">{uiText("pages.admin-survey-operations-page.f0a2540bcc")}</p> : <ul className="mt-3 space-y-2">{relations.map((relation) => <li key={relation.id} className="flex items-center justify-between rounded border p-2"><span>{events.find((event) => event.id === relation.eventId)?.title.value ?? relation.eventId} · {relation.syncMode === 'SURVEY_TO_EVENT' ? uiText("pages.admin-survey-operations-page.7e13819442") : uiText("pages.admin-survey-operations-page.7e1e74e4b8")}</span><button disabled={relationBusy} onClick={() => void unlink(relation)} className="text-red-700 disabled:opacity-50">{uiText("pages.admin-survey-operations-page.eb58837ff6")}</button></li>)}</ul>}
    </section>
    <table className="w-full bg-white text-left"><thead><tr><th>{uiText("pages.admin-survey-operations-page.d514e0091a")}</th><th>{uiText("pages.admin-survey-operations-page.2926977ba7")}</th><th>{uiText("pages.admin-survey-operations-page.9d9bf438ff")}</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id} className="border-t"><td>{response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '-'}</td><td>{response.state}</td><td><button onClick={() => void open(response.id)}>{uiText("pages.admin-survey-operations-page.bb446431d1")}</button></td></tr>)}</tbody></table>
    {selected && <section className="mt-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">{uiText("pages.admin-survey-operations-page.e94839ab1f")}</h2><ul>{selected.answers.map((answer) => <li key={answer.questionId}>{answer.questionId}: {'textValue' in answer ? answer.textValue : 'numberValue' in answer ? answer.numberValue : 'dateValue' in answer ? answer.dateValue : answer.choiceOptionIds.join(', ')}</li>)}</ul>{selected.state === 'SUBMITTED' && <div className="mt-4 flex gap-2"><input aria-label={uiText("pages.admin-survey-operations-page.6a3a652f95")} value={reason} onChange={(event) => setReason(event.target.value)} className="border px-2"/><button onClick={() => void review('APPROVED')}>{uiText("pages.admin-survey-operations-page.0d1cd67197")}</button><button onClick={() => void review('WAITLISTED')}>{uiText("pages.admin-survey-operations-page.df72a8753d")}</button><button onClick={() => void review('REJECTED')}>{uiText("pages.admin-survey-operations-page.d747407a52")}</button></div>}</section>}
  </section>;
}
