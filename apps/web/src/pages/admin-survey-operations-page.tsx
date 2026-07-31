import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AdminSurveyResponseListItem, SurveyAggregateResponse, SurveyResponseDto } from '@soc/contracts';
import { surveyApi } from '@/lib/survey-api';

export function AdminSurveyOperationsPage() {
  const { surveyId = '' } = useParams<{ surveyId: string }>();
  const [responses, setResponses] = useState<AdminSurveyResponseListItem[]>([]);
  const [aggregate, setAggregate] = useState<SurveyAggregateResponse | null>(null);
  const [selected, setSelected] = useState<SurveyResponseDto | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([surveyApi.responses(surveyId, controller.signal), surveyApi.aggregate(surveyId)])
      .then(([list, analysis]) => { setResponses(list.items); setAggregate(analysis); })
      .catch(() => setError('설문 응답을 불러오지 못했습니다.'));
    return () => controller.abort();
  }, [surveyId]);
  const open = async (id: string) => setSelected(await surveyApi.response(id));
  const review = async (state: 'APPROVED' | 'REJECTED' | 'WAITLISTED') => {
    if (!selected) return;
    const updated = await surveyApi.review(selected.id, state === 'REJECTED' ? { state, reason } : { state });
    setSelected(updated); setResponses((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated, surveyId: item.surveyId } : item));
  };
  return <section><h1 className="text-[32px] font-extrabold">설문 응답 및 분석</h1>{error && <p role="alert">{error}</p>}
    <div className="my-5 flex gap-3"><button className="rounded bg-kaist-darkgreen px-4 py-2 text-white" onClick={() => void surveyApi.export(surveyId, { format: 'CSV' })}>CSV 다운로드</button><strong>응답 수: {aggregate?.suppressed ? '5명 미만 (비공개)' : aggregate?.responseCount ?? '-'}</strong></div>
    {aggregate && <section className="mb-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">문항별 집계</h2>{aggregate.questions.map((question) => <div key={question.questionId} className="mt-3">{question.questionId}: {question.suppressed ? '비공개' : question.responseCount}{question.choices.map((choice) => <span key={choice.choiceOptionId} className="ml-3">{choice.choiceOptionId}: {choice.count}</span>)}</div>)}</section>}
    <table className="w-full bg-white text-left"><thead><tr><th>제출 시각</th><th>상태</th><th>작업</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id} className="border-t"><td>{response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '-'}</td><td>{response.state}</td><td><button onClick={() => void open(response.id)}>상세</button></td></tr>)}</tbody></table>
    {selected && <section className="mt-6 rounded bg-white p-5 shadow"><h2 className="text-xl font-bold">응답 상세</h2><ul>{selected.answers.map((answer) => <li key={answer.questionId}>{answer.questionId}: {'textValue' in answer ? answer.textValue : 'numberValue' in answer ? answer.numberValue : 'dateValue' in answer ? answer.dateValue : answer.choiceOptionIds.join(', ')}</li>)}</ul>{selected.state === 'SUBMITTED' && <div className="mt-4 flex gap-2"><input aria-label="반려 사유" value={reason} onChange={(event) => setReason(event.target.value)} className="border px-2"/><button onClick={() => void review('APPROVED')}>승인</button><button onClick={() => void review('WAITLISTED')}>대기</button><button onClick={() => void review('REJECTED')}>반려</button></div>}</section>}
  </section>;
}
