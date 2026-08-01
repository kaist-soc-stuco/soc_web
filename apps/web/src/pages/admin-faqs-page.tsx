import { FormEvent, useEffect, useState } from 'react';
import type { AdminFaqListResponse, FaqStatus } from '@soc/contracts';
import { adminFaqApi } from '@/lib/admin-faq-api';

const empty: AdminFaqListResponse = { topics: [], items: [] };
export function AdminFaqsPage() {
  const [data, setData] = useState(empty);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState({ titleKr: '', titleEn: '' });
  const [faq, setFaq] = useState({ topicId: '', questionKr: '', questionEn: '', answerKr: '', answerEn: '', status: 'PUBLISHED' as FaqStatus });
  const [submitting, setSubmitting] = useState(false);
  const load = async () => { try { const result = await adminFaqApi.list(); setData(result); setFaq((old) => ({ ...old, topicId: old.topicId || result.topics[0]?.id || '' })); setState('ready'); } catch { setState('error'); } };
  useEffect(() => { void load(); }, []);
  const act = async (operation: () => Promise<unknown>, success: string) => {
    if (submitting) return;
    setSubmitting(true); setMessage('');
    try { await operation(); await load(); setMessage(success); }
    catch { setMessage('요청을 처리하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };
  const createTopic = (event: FormEvent) => { event.preventDefault(); void act(() => adminFaqApi.createTopic({ ...topic, displayOrder: data.topics.length }), '주제를 추가했습니다.'); setTopic({ titleKr: '', titleEn: '' }); };
  const createFaq = (event: FormEvent) => { event.preventDefault(); if (!faq.topicId) return; void act(() => adminFaqApi.createFaq({ ...faq, displayOrder: data.items.filter((item) => item.topicId === faq.topicId).length }), 'FAQ를 추가했습니다.'); setFaq((old) => ({ ...old, questionKr: '', questionEn: '', answerKr: '', answerEn: '' })); };
  if (state === 'loading') return <p role="status">FAQ 관리 정보를 불러오는 중...</p>;
  if (state === 'error') return <p role="alert" className="text-red-600">FAQ 관리 정보를 불러오지 못했습니다.</p>;
  return <section>
    <h1 className="border-b border-kaist-grey/25 pb-4 text-[32px] font-extrabold">FAQ 관리</h1>
    {message ? <p role="status" className="mt-4 font-semibold">{message}</p> : null}
    <form onSubmit={createTopic} className="mt-6 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-bold">주제 추가</h2><div className="mt-4 grid gap-3 md:grid-cols-3">
      <input aria-label="주제 (한국어)" required value={topic.titleKr} onChange={(e) => setTopic({ ...topic, titleKr: e.target.value })} className="rounded border px-3 py-2" placeholder="한국어 주제" />
      <input aria-label="Topic (English)" required value={topic.titleEn} onChange={(e) => setTopic({ ...topic, titleEn: e.target.value })} className="rounded border px-3 py-2" placeholder="English topic" />
      <button disabled={submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? '처리 중...' : '주제 추가'}</button></div>
    </form>
    <form onSubmit={createFaq} className="mt-6 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-bold">FAQ 추가</h2><div className="mt-4 grid gap-3 md:grid-cols-2">
      <select aria-label="주제" required value={faq.topicId} onChange={(e) => setFaq({ ...faq, topicId: e.target.value })} className="rounded border px-3 py-2">{data.topics.map((item) => <option key={item.id} value={item.id}>{item.titleKr}</option>)}</select>
      <select aria-label="공개 상태" value={faq.status} onChange={(e) => setFaq({ ...faq, status: e.target.value as FaqStatus })} className="rounded border px-3 py-2"><option value="PUBLISHED">공개</option><option value="DRAFT">초안</option></select>
      {(['questionKr','questionEn','answerKr','answerEn'] as const).map((key) => <textarea key={key} aria-label={({questionKr:'질문 (한국어)',questionEn:'Question (English)',answerKr:'답변 (한국어)',answerEn:'Answer (English)'})[key]} required value={faq[key]} onChange={(e) => setFaq({ ...faq, [key]: e.target.value })} className="rounded border px-3 py-2" />)}
      <button disabled={!faq.topicId || submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? '처리 중...' : 'FAQ 추가'}</button></div>
    </form>
    <div className="mt-8 space-y-6">{data.topics.map((entry, topicIndex) => <article key={entry.id} className="rounded-lg border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{entry.titleKr} / {entry.titleEn}</h2><div className="flex gap-2">
      <button disabled={topicIndex === 0} onClick={() => void act(() => adminFaqApi.reorderTopic(entry.id, { displayOrder: topicIndex - 1 }), '순서를 변경했습니다.')} className="rounded border px-3 py-1">위로</button>
      <button onClick={() => void act(() => adminFaqApi.patchTopic(entry.id, { titleKr: prompt('한국어 주제', entry.titleKr) ?? entry.titleKr, titleEn: prompt('English topic', entry.titleEn) ?? entry.titleEn }), '주제를 수정했습니다.')} className="rounded border px-3 py-1">수정</button>
      <button disabled={submitting} aria-label={`${entry.titleKr} 주제 삭제`} onClick={() => { if (window.confirm(`${entry.titleKr} 주제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) void act(() => adminFaqApi.deleteTopic(entry.id), '주제를 삭제했습니다.'); }} className="rounded border border-red-500 px-3 py-1 text-red-600">삭제</button></div></div>
      <ul className="mt-4 divide-y">{data.items.filter((item) => item.topicId === entry.id).map((item) => <li key={item.id} className="py-4"><div className="flex justify-between gap-4"><div><p className="font-bold">{item.questionKr}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.answerKr}</p><p className="mt-2 text-xs text-kaist-grey">{item.status === 'PUBLISHED' ? '공개' : '초안'}</p></div><div className="flex shrink-0 gap-2"><button disabled={submitting} onClick={() => void act(() => adminFaqApi.patchFaq(item.id, { status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }), '공개 상태를 변경했습니다.')} className="rounded border px-3 py-1">{item.status === 'PUBLISHED' ? '비공개' : '공개'}</button><button disabled={submitting} aria-label={`${item.questionKr} FAQ 삭제`} onClick={() => { if (window.confirm(`${item.questionKr} FAQ를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) void act(() => adminFaqApi.deleteFaq(item.id), 'FAQ를 삭제했습니다.'); }} className="rounded border border-red-500 px-3 py-1 text-red-600">삭제</button></div></div></li>)}</ul>
    </article>)}</div>
  </section>;
}
