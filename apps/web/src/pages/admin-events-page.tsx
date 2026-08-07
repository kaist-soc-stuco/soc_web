import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { FormEvent, useEffect, useState } from 'react';
import type { EventItem, EventVisibility, SurveyDto } from '@soc/contracts';
import { adminEventApi } from '@/lib/admin-event-api';
import { formatScheduleDateTime } from '@/lib/schedule-date';
import { surveyApi } from '@/lib/survey-api';
const initial = { titleKr: '', titleEn: '', descriptionKr: '', descriptionEn: '', start: '', end: '', location: '', visibility: 'PUBLIC' as EventVisibility };
const localDateTime = (timestamp: number) => {
    const offset = new Date(timestamp).getTimezoneOffset() * 60_000;
    return new Date(timestamp - offset).toISOString().slice(0, 16);
};
export function AdminEventsPage() {
    const [items, setItems] = useState<EventItem[]>([]);
    const [surveys, setSurveys] = useState<SurveyDto[]>([]);
    const [surveyId, setSurveyId] = useState('');
    const [synchronize, setSynchronize] = useState(false);
    const [form, setForm] = useState(initial);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<EventItem | null>(null);
    const load = async () => {
        try {
            const [events, surveyList] = await Promise.all([adminEventApi.list(), surveyApi.listAdmin()]);
            setItems(events.items);
            setSurveys(surveyList.items);
        }
        catch {
            setMessage(uiText("pages.admin-events-page.f829dca55b"));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    const startEdit = async (item: EventItem) => {
        if (submitting)
            return;
        setSubmitting(true);
        setMessage('');
        try {
            const event = await adminEventApi.get(item.id);
            setEditingId(event.id);
            setForm({ titleKr: event.titleKr, titleEn: event.titleEn, descriptionKr: event.descriptionKr, descriptionEn: event.descriptionEn, start: localDateTime(event.startAtMs), end: localDateTime(event.endAtMs), location: event.location, visibility: event.visibility });
            setSurveyId('');
            setSynchronize(false);
        }
        catch {
            setMessage('행사 정보를 불러오지 못했습니다.');
        }
        finally {
            setSubmitting(false);
        }
    };
    const cancelEdit = () => {
        setEditingId(null);
        setForm(initial);
        setSurveyId('');
        setSynchronize(false);
    };
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting)
            return;
        setSubmitting(true);
        setMessage('');
        try {
            const input = { titleKr: form.titleKr, titleEn: form.titleEn, descriptionKr: form.descriptionKr, descriptionEn: form.descriptionEn, startAtMs: new Date(form.start).getTime(), endAtMs: new Date(form.end).getTime(), allDay: false as const, location: form.location, visibility: form.visibility };
            if (editingId) {
                await adminEventApi.patch(editingId, input);
            }
            else {
                const created = await adminEventApi.create(input);
                if (surveyId) {
                    await surveyApi.createRelation({ eventId: created.id, surveyId, relationType: 'SURVEY_PERIOD', syncMode: synchronize ? 'SURVEY_TO_EVENT' : 'NONE' });
                }
            }
            const wasEditing = Boolean(editingId);
            cancelEdit();
            await load();
            setMessage(wasEditing ? '행사를 수정했습니다.' : uiText("pages.admin-events-page.ab0b4377df"));
        }
        catch {
            setMessage(uiText("pages.admin-events-page.db520825df"));
        }
        finally {
            setSubmitting(false);
        }
    };
    const remove = async () => {
        if (!pendingDelete || submitting)
            return;
        setSubmitting(true);
        try {
            await adminEventApi.delete(pendingDelete.id);
            setPendingDelete(null);
            await load();
            setMessage(uiText("pages.admin-events-page.52bdec47f4"));
        }
        catch {
            setMessage(uiText("pages.admin-events-page.f3fbe0f54c"));
        }
        finally {
            setSubmitting(false);
        }
    };
    return <section><h1 className="border-b pb-4 text-[32px] font-extrabold">{uiText("pages.admin-events-page.3fbcbd1bef")}</h1>{message ? <p role="status" className="mt-4">{message}</p> : null}
    <form onSubmit={submit} className="mt-6 grid gap-3 rounded-lg border bg-white p-4 sm:p-5 md:grid-cols-2">
      {(['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'location'] as const).map((key) => <label key={key} className="grid gap-1 text-sm font-bold">{({ titleKr: uiText("pages.admin-events-page.b8fb134296"), titleEn: 'Title (English)', descriptionKr: uiText("pages.admin-events-page.d334abdd70"), descriptionEn: 'Description (English)', location: uiText("pages.admin-events-page.962eebc672") })[key]}<input required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="min-w-0 rounded border px-3 py-2 font-normal"/></label>)}
      <label className="grid gap-1 text-sm font-bold">{uiText("pages.admin-events-page.e89cc866ba")}<input aria-label={uiText("pages.admin-events-page.a0a2d62748")} required type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="min-w-0 rounded border px-3 py-2 font-normal"/></label>
      <label className="grid gap-1 text-sm font-bold">{uiText("pages.admin-events-page.cafdc61bbf")}<input aria-label={uiText("pages.admin-events-page.cef8aac2aa")} required type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="min-w-0 rounded border px-3 py-2 font-normal"/></label>
      <label className="grid gap-1 text-sm font-bold">{uiText("pages.admin-events-page.5dcf4fb9e9")}<select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as EventVisibility })} className="min-w-0 rounded border px-3 py-2 font-normal"><option value="PUBLIC">{uiText("pages.admin-events-page.58261d82b3")}</option><option value="AUTHENTICATED">{uiText("pages.admin-events-page.bc99e8f8cf")}</option><option value="COMMITTEE">{uiText("pages.admin-events-page.5c8a713440")}</option></select></label>
      <label className="grid gap-1 text-sm font-bold">{uiText("pages.admin-events-page.25bc0b519e")}<select aria-label={uiText("pages.admin-events-page.2f5ae22c03")} value={surveyId} onChange={(event) => setSurveyId(event.target.value)} className="min-w-0 rounded border px-3 py-2 font-normal"><option value="">{uiText("pages.admin-events-page.b894db774d")}</option>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title.value ?? survey.id}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={synchronize} disabled={!surveyId} onChange={(event) => setSynchronize(event.target.checked)}/>{uiText("pages.admin-events-page.b79e3d9ca2")}</label>
      <div className="flex flex-wrap gap-2"><button disabled={submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? uiText("pages.admin-events-page.e6e1a2914f") : editingId ? '행사 수정' : uiText("pages.admin-events-page.d0b6c25bfc")}</button>{editingId && <button type="button" disabled={submitting} onClick={cancelEdit} className="rounded border px-4 py-2 font-bold">수정 취소</button>}</div>
    </form>
    {loading ? <p role="status" className="mt-6">{uiText("pages.admin-events-page.c21bd66dd4")}</p> : <ul className="mt-6 divide-y rounded-lg border bg-white">{items.map((item) => <li key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.title.value}</strong><p className="text-sm text-kaist-grey">{formatScheduleDateTime(item.startAtMs)} · {item.location}</p></div><div className="flex gap-2"><button type="button" disabled={submitting} onClick={() => void startEdit(item)} className="self-start rounded border px-3 py-1 font-bold sm:self-auto">수정</button><button type="button" aria-label={uiFormat("pages.admin-events-page.template.48c1c4355f", [item.title.value])} disabled={submitting} onClick={() => setPendingDelete(item)} className="self-start rounded border border-red-500 px-3 py-1 text-red-600 sm:self-auto">{uiText("pages.admin-events-page.fc81e222b9")}</button></div></li>)}</ul>}
    {pendingDelete && <div role="dialog" aria-modal="true" aria-labelledby="event-delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded bg-white p-6"><h2 id="event-delete-title" className="text-lg font-extrabold">{pendingDelete.title.value}{uiText("pages.admin-events-page.d25aea5599")}</h2><p className="mt-2">{uiText("pages.admin-events-page.cdfb991d17")}</p><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setPendingDelete(null)}>{uiText("pages.admin-events-page.19b2d19bc1")}</button><button type="button" disabled={submitting} onClick={() => void remove()} className="rounded bg-red-700 px-4 py-2 font-bold text-white">{submitting ? uiText("pages.admin-events-page.d2884b2998") : uiText("pages.admin-events-page.8c8ffb4aa6")}</button></div></div></div>}
  </section>;
}
