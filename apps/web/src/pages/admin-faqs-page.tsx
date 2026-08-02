import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
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
    const load = async () => {
        try {
            const result = await adminFaqApi.list();
            setData(result);
            setFaq((old) => ({ ...old, topicId: old.topicId || result.topics[0]?.id || '' }));
            setState('ready');
        }
        catch {
            setState('error');
        }
    };
    useEffect(() => { void load(); }, []);
    const act = async (operation: () => Promise<unknown>, success: string) => {
        if (submitting)
            return;
        setSubmitting(true);
        setMessage('');
        try {
            await operation();
            await load();
            setMessage(success);
        }
        catch {
            setMessage(uiText("pages.admin-faqs-page.0b95817724"));
        }
        finally {
            setSubmitting(false);
        }
    };
    const createTopic = (event: FormEvent) => { event.preventDefault(); void act(() => adminFaqApi.createTopic({ ...topic, displayOrder: data.topics.length }), uiText("pages.admin-faqs-page.8fb50bc12f")); setTopic({ titleKr: '', titleEn: '' }); };
    const createFaq = (event: FormEvent) => {
        event.preventDefault();
        if (!faq.topicId)
            return;
        void act(() => adminFaqApi.createFaq({ ...faq, displayOrder: data.items.filter((item) => item.topicId === faq.topicId).length }), uiText("pages.admin-faqs-page.4ff897a353"));
        setFaq((old) => ({ ...old, questionKr: '', questionEn: '', answerKr: '', answerEn: '' }));
    };
    if (state === 'loading')
        return <p role="status">{uiText("pages.admin-faqs-page.911dce35a6")}</p>;
    if (state === 'error')
        return <p role="alert" className="text-red-600">{uiText("pages.admin-faqs-page.8088f93c42")}</p>;
    return <section>
    <h1 className="border-b border-kaist-grey/25 pb-4 text-[32px] font-extrabold">{uiText("pages.admin-faqs-page.8bf5517dd2")}</h1>
    {message ? <p role="status" className="mt-4 font-semibold">{message}</p> : null}
    <form onSubmit={createTopic} className="mt-6 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-bold">{uiText("pages.admin-faqs-page.f454e33eac")}</h2><div className="mt-4 grid gap-3 md:grid-cols-3">
      <input aria-label={uiText("pages.admin-faqs-page.be425a8f57")} required value={topic.titleKr} onChange={(e) => setTopic({ ...topic, titleKr: e.target.value })} className="rounded border px-3 py-2" placeholder={uiText("pages.admin-faqs-page.9cfcd41e8a")}/>
      <input aria-label="Topic (English)" required value={topic.titleEn} onChange={(e) => setTopic({ ...topic, titleEn: e.target.value })} className="rounded border px-3 py-2" placeholder="English topic"/>
      <button disabled={submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? uiText("pages.admin-faqs-page.e6e1a2914f") : uiText("pages.admin-faqs-page.f454e33eac")}</button></div>
    </form>
    <form onSubmit={createFaq} className="mt-6 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-bold">{uiText("pages.admin-faqs-page.2b625e9172")}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">
      <select aria-label={uiText("pages.admin-faqs-page.0fa1d7b4b4")} required value={faq.topicId} onChange={(e) => setFaq({ ...faq, topicId: e.target.value })} className="rounded border px-3 py-2">{data.topics.map((item) => <option key={item.id} value={item.id}>{item.titleKr}</option>)}</select>
      <select aria-label={uiText("pages.admin-faqs-page.e35d27e8ff")} value={faq.status} onChange={(e) => setFaq({ ...faq, status: e.target.value as FaqStatus })} className="rounded border px-3 py-2"><option value="PUBLISHED">{uiText("pages.admin-faqs-page.be008093ef")}</option><option value="DRAFT">{uiText("pages.admin-faqs-page.d9aaeb45fd")}</option></select>
      {(['questionKr', 'questionEn', 'answerKr', 'answerEn'] as const).map((key) => <textarea key={key} aria-label={({ questionKr: uiText("pages.admin-faqs-page.08b859d229"), questionEn: 'Question (English)', answerKr: uiText("pages.admin-faqs-page.558541a673"), answerEn: 'Answer (English)' })[key]} required value={faq[key]} onChange={(e) => setFaq({ ...faq, [key]: e.target.value })} className="rounded border px-3 py-2"/>)}
      <button disabled={!faq.topicId || submitting} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white disabled:opacity-50">{submitting ? uiText("pages.admin-faqs-page.e6e1a2914f") : uiText("pages.admin-faqs-page.2b625e9172")}</button></div>
    </form>
    <div className="mt-8 space-y-6">{data.topics.map((entry, topicIndex) => <article key={entry.id} className="rounded-lg border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{entry.titleKr} / {entry.titleEn}</h2><div className="flex gap-2">
      <button disabled={topicIndex === 0} onClick={() => void act(() => adminFaqApi.reorderTopic(entry.id, { displayOrder: topicIndex - 1 }), uiText("pages.admin-faqs-page.93717f16f9"))} className="rounded border px-3 py-1">{uiText("pages.admin-faqs-page.08f78639fa")}</button>
      <button onClick={() => void act(() => adminFaqApi.patchTopic(entry.id, { titleKr: prompt(uiText("pages.admin-faqs-page.9cfcd41e8a"), entry.titleKr) ?? entry.titleKr, titleEn: prompt('English topic', entry.titleEn) ?? entry.titleEn }), uiText("pages.admin-faqs-page.377c735899"))} className="rounded border px-3 py-1">{uiText("pages.admin-faqs-page.e1407b5115")}</button>
      <button disabled={submitting} aria-label={uiFormat("pages.admin-faqs-page.template.92aa4bbc6e", [entry.titleKr])} onClick={() => {
                if (window.confirm(uiFormat("pages.admin-faqs-page.template.fecf2365f4", [entry.titleKr])))
                    void act(() => adminFaqApi.deleteTopic(entry.id), uiText("pages.admin-faqs-page.9d3fb77ea7"));
            }} className="rounded border border-red-500 px-3 py-1 text-red-600">{uiText("pages.admin-faqs-page.fc81e222b9")}</button></div></div>
      <ul className="mt-4 divide-y">{data.items.filter((item) => item.topicId === entry.id).map((item) => <li key={item.id} className="py-4"><div className="flex justify-between gap-4"><div><p className="font-bold">{item.questionKr}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.answerKr}</p><p className="mt-2 text-xs text-kaist-grey">{item.status === 'PUBLISHED' ? uiText("pages.admin-faqs-page.be008093ef") : uiText("pages.admin-faqs-page.d9aaeb45fd")}</p></div><div className="flex shrink-0 gap-2"><button disabled={submitting} onClick={() => void act(() => adminFaqApi.patchFaq(item.id, { status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }), uiText("pages.admin-faqs-page.41abbb3843"))} className="rounded border px-3 py-1">{item.status === 'PUBLISHED' ? uiText("pages.admin-faqs-page.331c680ab2") : uiText("pages.admin-faqs-page.be008093ef")}</button><button disabled={submitting} aria-label={uiFormat("pages.admin-faqs-page.template.39234a5ad1", [item.questionKr])} onClick={() => {
                    if (window.confirm(uiFormat("pages.admin-faqs-page.template.45d2c52b45", [item.questionKr])))
                        void act(() => adminFaqApi.deleteFaq(item.id), uiText("pages.admin-faqs-page.5ca6e3e352"));
                }} className="rounded border border-red-500 px-3 py-1 text-red-600">{uiText("pages.admin-faqs-page.fc81e222b9")}</button></div></div></li>)}</ul>
    </article>)}</div>
  </section>;
}
