import { FormEvent, useEffect, useState } from 'react';
import type { EventItem, EventVisibility, SurveyDto } from '@soc/contracts';
import { adminEventApi } from '@/lib/admin-event-api';
import { surveyApi } from '@/lib/survey-api';

const initial = { titleKr: '', titleEn: '', descriptionKr: '', descriptionEn: '', start: '', end: '', location: '', visibility: 'PUBLIC' as EventVisibility };

export function AdminEventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [surveys, setSurveys] = useState<SurveyDto[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [synchronize, setSynchronize] = useState(false);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventItem | null>(null);
  const load = async () => {
    try {
      const [events, surveyList] = await Promise.all([adminEventApi.list(), surveyApi.listAdmin()]);
      setItems(events.items);
      setSurveys(surveyList.items);
    } catch {
      setMessage('행사 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setMessage('');
    try {
      const created = await adminEventApi.create({ titleKr: form.titleKr, titleEn: form.titleEn, descriptionKr: form.descriptionKr, descriptionEn: form.descriptionEn, startAtMs: new Date(form.start).getTime(), endAtMs: new Date(form.end).getTime(), allDay: false, location: form.location, visibility: form.visibility });
      if (surveyId) {
        await surveyApi.createRelation({ eventId: created.id, surveyId, relationType: 'SURVEY_PERIOD', syncMode: synchronize ? 'SURVEY_TO_EVENT' : 'NONE' });
      }
      setForm(initial);
      setSurveyId('');
      setSynchronize(false);
      await load();
      setMessage('행사를 추가했습니다.');
    } catch { setMessage('행사를 추가하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };
  const remove = async () => {
    if (!pendingDelete || submitting) return;
    setSubmitting(true);
    try { await adminEventApi.delete(pendingDelete.id); setPendingDelete(null); await load(); setMessage('행사를 삭제했습니다.'); }
    catch { setMessage('행사를 삭제하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };
  return <section><h1 className="border-b pb-4 text-[32px] font-extrabold">행사 관리</h1>{message ? <p role="status" className="mt-4">{message}</p> : null}
    <form onSubmit={submit} className="mt-6 grid gap-3 rounded-lg border bg-white p-4 sm:p-5 md:grid-cols-2">
      {(['titleKr','titleEn','descriptionKr','descriptionEn','location'] as const).map((key) => <label key={key} className="grid gap-1 text-sm font-bold">{({titleKr:'제목 (한국어)',titleEn:'Title (English)',descriptionKr:'설명 (한국어)',descriptionEn:'Description (English)',location:'장소'})[key]}<input required value={form[key]} onChange={(e) => setForm({...form,[key]:e.target.value})} className="min-w-0 rounded border px-3 py-2 font-normal" /></label>)}
      <label className="grid gap-1 text-sm font-bold">시작<input aria-label="행사 시작 일시" required type="datetime-local" value={form.start} onChange={(e) => setForm({...form,start:e.target.value})} className="min-w-0 rounded border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-bold">종료<input aria-label="행사 종료 일시" required type="datetime-local" value={form.end} onChange={(e) => setForm({...form,end:e.target.value})} className="min-w-0 rounded border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-bold">공개 범위<select value={form.visibility} onChange={(e) => setForm({...form,visibility:e.target.value as EventVisibility})} className="min-w-0 rounded border px-3 py-2 font-normal"><option value="PUBLIC">전체 공개</option><option value="AUTHENTICATED">로그인 사용자</option><option value="COMMITTEE">집행위원</option></select></label>
      <label className="grid gap-1 text-sm font-bold">연결할 설문 (선택)<select aria-label="연결할 설문" value={surveyId} onChange={(event) => setSurveyId(event.target.value)} className="min-w-0 rounded border px-3 py-2 font-normal"><option value="">연결하지 않음</option>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title.value ?? survey.id}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={synchronize} disabled={!surveyId} onChange={(event) => setSynchronize(event.target.checked)} />설문 기간을 행사에 동기화</label>
      <button disabled={submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? '처리 중...' : '행사 추가'}</button>
    </form>
    {loading ? <p role="status" className="mt-6">불러오는 중...</p> : <ul className="mt-6 divide-y rounded-lg border bg-white">{items.map((item) => <li key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.title.value}</strong><p className="text-sm text-kaist-grey">{new Date(item.startAtMs).toLocaleString('ko-KR')} · {item.location}</p></div><button type="button" aria-label={`${item.title.value} 삭제`} disabled={submitting} onClick={() => setPendingDelete(item)} className="self-start rounded border border-red-500 px-3 py-1 text-red-600 sm:self-auto">삭제</button></li>)}</ul>}
    {pendingDelete && <div role="dialog" aria-modal="true" aria-labelledby="event-delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded bg-white p-6"><h2 id="event-delete-title" className="text-lg font-extrabold">{pendingDelete.title.value} 행사 삭제</h2><p className="mt-2">이 작업은 되돌릴 수 없습니다.</p><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setPendingDelete(null)}>취소</button><button type="button" disabled={submitting} onClick={() => void remove()} className="rounded bg-red-700 px-4 py-2 font-bold text-white">{submitting ? '삭제 중...' : '행사 삭제 확인'}</button></div></div></div>}
  </section>;
}
