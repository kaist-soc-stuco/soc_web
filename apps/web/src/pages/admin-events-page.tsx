import { CalendarDays } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { EventItem, EventVisibility, SurveyDto } from '@soc/contracts';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
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
    } catch {
      setMessage(uiText('pages.admin-events-page.f829dca55b'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = async (item: EventItem) => {
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const event = await adminEventApi.get(item.id);
      setEditingId(event.id);
      setForm({
        titleKr: event.titleKr,
        titleEn: event.titleEn,
        descriptionKr: event.descriptionKr,
        descriptionEn: event.descriptionEn,
        start: localDateTime(event.startAtMs),
        end: localDateTime(event.endAtMs),
        location: event.location,
        visibility: event.visibility,
      });
      setSurveyId('');
      setSynchronize(false);
    } catch {
      setMessage('행사 정보를 불러오지 못했습니다.');
    } finally {
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
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const input = {
        titleKr: form.titleKr,
        titleEn: form.titleEn,
        descriptionKr: form.descriptionKr,
        descriptionEn: form.descriptionEn,
        startAtMs: new Date(form.start).getTime(),
        endAtMs: new Date(form.end).getTime(),
        allDay: false as const,
        location: form.location,
        visibility: form.visibility,
      };
      if (editingId) {
        await adminEventApi.patch(editingId, input);
      } else {
        const created = await adminEventApi.create(input);
        if (surveyId) {
          await surveyApi.createRelation({ eventId: created.id, surveyId, relationType: 'SURVEY_PERIOD', syncMode: synchronize ? 'SURVEY_TO_EVENT' : 'NONE' });
        }
      }
      const wasEditing = Boolean(editingId);
      cancelEdit();
      await load();
      setMessage(wasEditing ? '행사를 수정했습니다.' : uiText('pages.admin-events-page.ab0b4377df'));
    } catch {
      setMessage(uiText('pages.admin-events-page.db520825df'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete || submitting) return;
    setSubmitting(true);
    try {
      await adminEventApi.delete(pendingDelete.id);
      setPendingDelete(null);
      await load();
      setMessage(uiText('pages.admin-events-page.52bdec47f4'));
    } catch {
      setMessage(uiText('pages.admin-events-page.f3fbe0f54c'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Content</p>
          <h1>{uiText('pages.admin-events-page.3fbcbd1bef')}</h1>
          <p>캘린더에 노출되는 행사와 연결 설문을 등록하고 관리합니다.</p>
        </div>
        <div className="admin-heading-stat">
          <span>{items.length}</span>
          <p>registered events</p>
        </div>
      </div>

      {message ? <p role="status">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">Schedule</p>
              <h2>{uiText('pages.admin-events-page.3fbcbd1bef')}</h2>
            </div>
          </div>

          {loading ? (
            <p role="status">{uiText('pages.admin-events-page.c21bd66dd4')}</p>
          ) : (
            <div className="divide-y divide-[#98A0AC]/25">
              {items.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 border-0 px-0 py-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#E4F6EC] text-[#006B4A]">
                      <CalendarDays className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[17px] text-[#39404B]">{item.title.value}</strong>
                      <p className="mt-1 text-sm font-semibold text-[#68736D]">{formatScheduleDateTime(item.startAtMs)} · {item.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={submitting} onClick={() => void startEdit(item)}>수정</button>
                    <button type="button" aria-label={uiFormat('pages.admin-events-page.template.48c1c4355f', [item.title.value])} disabled={submitting} onClick={() => setPendingDelete(item)} className="text-red-600">
                      {uiText('pages.admin-events-page.fc81e222b9')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="admin-panel grid content-start gap-3">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">{editingId ? 'Edit' : 'Create'}</p>
              <h2>{editingId ? '행사 수정' : uiText('pages.admin-events-page.d0b6c25bfc')}</h2>
            </div>
          </div>

          {(['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'location'] as const).map((key) => (
            <label key={key}>
              {({ titleKr: uiText('pages.admin-events-page.b8fb134296'), titleEn: 'Title (English)', descriptionKr: uiText('pages.admin-events-page.d334abdd70'), descriptionEn: 'Description (English)', location: uiText('pages.admin-events-page.962eebc672') })[key]}
              <input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
            </label>
          ))}
          <label>
            {uiText('pages.admin-events-page.e89cc866ba')}
            <input aria-label={uiText('pages.admin-events-page.a0a2d62748')} required type="datetime-local" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
          </label>
          <label>
            {uiText('pages.admin-events-page.cafdc61bbf')}
            <input aria-label={uiText('pages.admin-events-page.cef8aac2aa')} required type="datetime-local" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} />
          </label>
          <label>
            {uiText('pages.admin-events-page.5dcf4fb9e9')}
            <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as EventVisibility })}>
              <option value="PUBLIC">{uiText('pages.admin-events-page.58261d82b3')}</option>
              <option value="AUTHENTICATED">{uiText('pages.admin-events-page.bc99e8f8cf')}</option>
              <option value="COMMITTEE">{uiText('pages.admin-events-page.5c8a713440')}</option>
            </select>
          </label>
          <label>
            {uiText('pages.admin-events-page.25bc0b519e')}
            <select aria-label={uiText('pages.admin-events-page.2f5ae22c03')} value={surveyId} onChange={(event) => setSurveyId(event.target.value)} disabled={Boolean(editingId)}>
              <option value="">{uiText('pages.admin-events-page.b894db774d')}</option>
              {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title.value ?? survey.id}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={synchronize} disabled={!surveyId || Boolean(editingId)} onChange={(event) => setSynchronize(event.target.checked)} />
            {uiText('pages.admin-events-page.b79e3d9ca2')}
          </label>
          <div className="flex flex-wrap gap-2 border-t border-[#98A0AC]/25 pt-4">
            <button disabled={submitting} type="submit">{submitting ? uiText('pages.admin-events-page.e6e1a2914f') : editingId ? '행사 수정' : uiText('pages.admin-events-page.d0b6c25bfc')}</button>
            {editingId ? <button type="button" disabled={submitting} onClick={cancelEdit}>수정 취소</button> : null}
          </div>
        </form>
      </div>

      {pendingDelete ? (
        <div role="dialog" aria-modal="true" aria-labelledby="event-delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md">
            <h2 id="event-delete-title" className="text-lg font-extrabold">{pendingDelete.title.value}{uiText('pages.admin-events-page.d25aea5599')}</h2>
            <p className="mt-2">{uiText('pages.admin-events-page.cdfb991d17')}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={submitting} onClick={() => setPendingDelete(null)}>{uiText('pages.admin-events-page.19b2d19bc1')}</button>
              <button type="button" disabled={submitting} onClick={() => void remove()} className="bg-red-700 text-white">
                {submitting ? uiText('pages.admin-events-page.d2884b2998') : uiText('pages.admin-events-page.8c8ffb4aa6')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
