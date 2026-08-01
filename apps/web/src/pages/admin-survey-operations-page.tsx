import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AdminSurveyResponseListItem, ContentMatcherDto, EventItem, SurveyAggregateResponse, SurveyResponseDto } from '@soc/contracts';
import { adminEventApi } from '@/lib/admin-event-api';
import { surveyApi } from '@/lib/survey-api';

export function AdminSurveyOperationsPage() {
  const { surveyId = '' } = useParams<{ surveyId: string }>();
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
      .catch(() => setError('설문 정보를 불러오지 못했습니다.'));
    return () => controller.abort();
  }, [surveyId]);
  const open = async (id: string) => setSelected(await surveyApi.response(id));
  const review = async (state: 'APPROVED' | 'REJECTED' | 'WAITLISTED') => {
    if (!selected) return;
    const updated = await surveyApi.review(selected.id, state === 'REJECTED' ? { state, reason } : { state });
    setSelected(updated); setResponses((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated, surveyId: item.surveyId } : item));
  };
  const linkEvent = async () => {
    if (!eventId || relationBusy) return;
    setRelationBusy(true); setError('');
    try {
      const relation = await surveyApi.createRelation({ eventId, surveyId, relationType: 'SURVEY_PERIOD', syncMode: synchronize ? 'SURVEY_TO_EVENT' : 'NONE' });
      setRelations((items) => [relation, ...items]); setEventId(''); setSynchronize(false);
    } catch { setError('행사 연결에 실패했습니다.'); } finally { setRelationBusy(false); }
  };
  const unlink = async (relation: ContentMatcherDto) => {
    if (relationBusy) return;
    setRelationBusy(true); setError('');
    try { await surveyApi.deleteRelation(relation.id); setRelations((items) => items.filter((item) => item.id !== relation.id)); }
    catch { setError('연결 해제에 실패했습니다.'); } finally { setRelationBusy(false); }
  };
  const materialize = async () => {
    if (!materializeLocation.trim() || relationBusy) return;
    setRelationBusy(true); setError('');
    try {
      const result = await surveyApi.materializeEvent(surveyId, { location: materializeLocation.trim(), visibility: 'PUBLIC' });
      setRelations((items) => [result.relation, ...items]); setMaterializeLocation('');
      const eventList = await adminEventApi.list(); setEvents(eventList.items);
    } catch { setError('설문 기간 행사 생성에 실패했습니다. 설문 시작/종료 시각을 확인해 주세요.'); } finally { setRelationBusy(false); }
  };
  return <section><h1 className="text-[32px] font-extrabold">설문 응답 및 분석</h1>{error && <p role="alert">{error}</p>}
    <div className="my-5 flex gap-3"><button className="rounded bg-kaist-darkgreen px-4 py-2 text-white" onClick={() => void surveyApi.export(surveyId, { format: 'CSV' })}>CSV 다운로드</button><strong>응답 수: {aggregate?.suppressed ? '5명 미만 (비공개)' : aggregate?.responseCount ?? '-'}</strong></div>
    {aggregate && <section className="mb-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">문항별 집계</h2>{aggregate.questions.map((question) => <div key={question.questionId} className="mt-3">{question.questionId}: {question.suppressed ? '비공개' : question.responseCount}{question.choices.map((choice) => <span key={choice.choiceOptionId} className="ml-3">{choice.choiceOptionId}: {choice.count}</span>)}</div>)}</section>}
    <section className="mb-6 rounded bg-white p-5 shadow">
      <h2 className="text-xl font-bold">연결된 설문 기간 행사</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1">행사 선택<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="border px-2 py-1"><option value="">행사를 선택하세요</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title.value ?? event.id}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={synchronize} onChange={(event) => setSynchronize(event.target.checked)}/>설문 기간을 행사에 동기화</label>
        <button disabled={!eventId || relationBusy} onClick={() => void linkEvent()} className="rounded bg-kaist-darkgreen px-3 py-2 text-white disabled:opacity-50">연결</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><label className="grid gap-1">새 기간 행사 장소<input value={materializeLocation} onChange={(event) => setMaterializeLocation(event.target.value)} className="border px-2 py-1"/></label><button disabled={!materializeLocation.trim() || relationBusy} onClick={() => void materialize()} className="rounded border border-kaist-darkgreen px-3 py-2 text-kaist-darkgreen disabled:opacity-50">설문 기간 행사 생성</button></div>
      {relations.length === 0 ? <p className="mt-3 text-slate-600">연결된 행사가 없습니다.</p> : <ul className="mt-3 space-y-2">{relations.map((relation) => <li key={relation.id} className="flex items-center justify-between rounded border p-2"><span>{events.find((event) => event.id === relation.eventId)?.title.value ?? relation.eventId} · {relation.syncMode === 'SURVEY_TO_EVENT' ? '설문→행사 동기화' : '독립 일정'}</span><button disabled={relationBusy} onClick={() => void unlink(relation)} className="text-red-700 disabled:opacity-50">연결 해제</button></li>)}</ul>}
    </section>
    <table className="w-full bg-white text-left"><thead><tr><th>제출 시각</th><th>상태</th><th>작업</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id} className="border-t"><td>{response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '-'}</td><td>{response.state}</td><td><button onClick={() => void open(response.id)}>상세</button></td></tr>)}</tbody></table>
    {selected && <section className="mt-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">응답 상세</h2><ul>{selected.answers.map((answer) => <li key={answer.questionId}>{answer.questionId}: {'textValue' in answer ? answer.textValue : 'numberValue' in answer ? answer.numberValue : 'dateValue' in answer ? answer.dateValue : answer.choiceOptionIds.join(', ')}</li>)}</ul>{selected.state === 'SUBMITTED' && <div className="mt-4 flex gap-2"><input aria-label="반려 사유" value={reason} onChange={(event) => setReason(event.target.value)} className="border px-2"/><button onClick={() => void review('APPROVED')}>승인</button><button onClick={() => void review('WAITLISTED')}>대기</button><button onClick={() => void review('REJECTED')}>반려</button></div>}</section>}
  </section>;
}
