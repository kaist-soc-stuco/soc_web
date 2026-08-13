import { FormEvent, useEffect, useState } from 'react';
import type { AdminFaqListResponse, FaqStatus } from '@soc/contracts';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
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
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (operation: () => Promise<unknown>, success: string) => {
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      await operation();
      await load();
      setMessage(success);
    } catch {
      setMessage(uiText('pages.admin-faqs-page.0b95817724'));
    } finally {
      setSubmitting(false);
    }
  };

  const createTopic = (event: FormEvent) => {
    event.preventDefault();
    void act(() => adminFaqApi.createTopic({ ...topic, displayOrder: data.topics.length }), uiText('pages.admin-faqs-page.8fb50bc12f'));
    setTopic({ titleKr: '', titleEn: '' });
  };

  const createFaq = (event: FormEvent) => {
    event.preventDefault();
    if (!faq.topicId) return;
    void act(() => adminFaqApi.createFaq({ ...faq, displayOrder: data.items.filter((item) => item.topicId === faq.topicId).length }), uiText('pages.admin-faqs-page.4ff897a353'));
    setFaq((old) => ({ ...old, questionKr: '', questionEn: '', answerKr: '', answerEn: '' }));
  };

  if (state === 'loading') return <p role="status">{uiText('pages.admin-faqs-page.911dce35a6')}</p>;
  if (state === 'error') return <p role="alert">{uiText('pages.admin-faqs-page.8088f93c42')}</p>;

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Content</p>
          <h1>{uiText('pages.admin-faqs-page.8bf5517dd2')}</h1>
          <p>FAQ 주제와 문항을 만들고, 공개 상태를 관리합니다.</p>
        </div>
        <div className="admin-heading-stat">
          <span>{data.items.length}</span>
          <p>faq items</p>
        </div>
      </div>

      {message ? <p role="status">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <form onSubmit={createTopic} className="admin-panel grid gap-3">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">Topic</p>
                <h2>{uiText('pages.admin-faqs-page.f454e33eac')}</h2>
              </div>
            </div>
            <label>
              {uiText('pages.admin-faqs-page.be425a8f57')}
              <input aria-label={uiText('pages.admin-faqs-page.be425a8f57')} required value={topic.titleKr} onChange={(event) => setTopic({ ...topic, titleKr: event.target.value })} placeholder={uiText('pages.admin-faqs-page.9cfcd41e8a')} />
            </label>
            <label>
              Topic (English)
              <input aria-label="Topic (English)" required value={topic.titleEn} onChange={(event) => setTopic({ ...topic, titleEn: event.target.value })} placeholder="English topic" />
            </label>
            <button disabled={submitting} type="submit">{submitting ? uiText('pages.admin-faqs-page.e6e1a2914f') : uiText('pages.admin-faqs-page.f454e33eac')}</button>
          </form>

          <form onSubmit={createFaq} className="admin-panel grid gap-3">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">FAQ</p>
                <h2>{uiText('pages.admin-faqs-page.2b625e9172')}</h2>
              </div>
            </div>
            <label>
              {uiText('pages.admin-faqs-page.0fa1d7b4b4')}
              <select aria-label={uiText('pages.admin-faqs-page.0fa1d7b4b4')} required value={faq.topicId} onChange={(event) => setFaq({ ...faq, topicId: event.target.value })}>
                {data.topics.map((item) => <option key={item.id} value={item.id}>{item.titleKr}</option>)}
              </select>
            </label>
            <label>
              {uiText('pages.admin-faqs-page.e35d27e8ff')}
              <select aria-label={uiText('pages.admin-faqs-page.e35d27e8ff')} value={faq.status} onChange={(event) => setFaq({ ...faq, status: event.target.value as FaqStatus })}>
                <option value="PUBLISHED">{uiText('pages.admin-faqs-page.be008093ef')}</option>
                <option value="DRAFT">{uiText('pages.admin-faqs-page.d9aaeb45fd')}</option>
              </select>
            </label>
            {(['questionKr', 'questionEn', 'answerKr', 'answerEn'] as const).map((key) => (
              <label key={key}>
                {({ questionKr: uiText('pages.admin-faqs-page.08b859d229'), questionEn: 'Question (English)', answerKr: uiText('pages.admin-faqs-page.558541a673'), answerEn: 'Answer (English)' })[key]}
                <textarea
                  aria-label={({ questionKr: uiText('pages.admin-faqs-page.08b859d229'), questionEn: 'Question (English)', answerKr: uiText('pages.admin-faqs-page.558541a673'), answerEn: 'Answer (English)' })[key]}
                  required
                  value={faq[key]}
                  onChange={(event) => setFaq({ ...faq, [key]: event.target.value })}
                />
              </label>
            ))}
            <button disabled={!faq.topicId || submitting} type="submit">{submitting ? uiText('pages.admin-faqs-page.e6e1a2914f') : uiText('pages.admin-faqs-page.2b625e9172')}</button>
          </form>
        </div>

        <div className="grid content-start gap-4">
          {data.topics.map((entry, topicIndex) => {
            const items = data.items.filter((item) => item.topicId === entry.id);
            return (
              <article key={entry.id} className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <p className="admin-eyebrow">{items.length} items</p>
                    <h2>{entry.titleKr} / {entry.titleEn}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={topicIndex === 0} onClick={() => void act(() => adminFaqApi.reorderTopic(entry.id, { displayOrder: topicIndex - 1 }), uiText('pages.admin-faqs-page.93717f16f9'))}>{uiText('pages.admin-faqs-page.08f78639fa')}</button>
                    <button onClick={() => void act(() => adminFaqApi.patchTopic(entry.id, { titleKr: prompt(uiText('pages.admin-faqs-page.9cfcd41e8a'), entry.titleKr) ?? entry.titleKr, titleEn: prompt('English topic', entry.titleEn) ?? entry.titleEn }), uiText('pages.admin-faqs-page.377c735899'))}>{uiText('pages.admin-faqs-page.e1407b5115')}</button>
                    <button
                      disabled={submitting}
                      aria-label={uiFormat('pages.admin-faqs-page.template.92aa4bbc6e', [entry.titleKr])}
                      onClick={() => {
                        if (window.confirm(uiFormat('pages.admin-faqs-page.template.fecf2365f4', [entry.titleKr]))) void act(() => adminFaqApi.deleteTopic(entry.id), uiText('pages.admin-faqs-page.9d3fb77ea7'));
                      }}
                      className="text-red-600"
                    >
                      {uiText('pages.admin-faqs-page.fc81e222b9')}
                    </button>
                  </div>
                </div>

                <ul className="divide-y divide-[#98A0AC]/25">
                  {items.map((item) => (
                    <li key={item.id} className="py-4">
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-extrabold text-[#39404B]">{item.questionKr}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-[#68736D]">{item.answerKr}</p>
                          <p className="mt-2 text-xs font-extrabold text-[#006B4A]">{item.status === 'PUBLISHED' ? uiText('pages.admin-faqs-page.be008093ef') : uiText('pages.admin-faqs-page.d9aaeb45fd')}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button disabled={submitting} onClick={() => void act(() => adminFaqApi.patchFaq(item.id, { status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }), uiText('pages.admin-faqs-page.41abbb3843'))}>
                            {item.status === 'PUBLISHED' ? uiText('pages.admin-faqs-page.331c680ab2') : uiText('pages.admin-faqs-page.be008093ef')}
                          </button>
                          <button
                            disabled={submitting}
                            aria-label={uiFormat('pages.admin-faqs-page.template.39234a5ad1', [item.questionKr])}
                            onClick={() => {
                              if (window.confirm(uiFormat('pages.admin-faqs-page.template.45d2c52b45', [item.questionKr]))) void act(() => adminFaqApi.deleteFaq(item.id), uiText('pages.admin-faqs-page.5ca6e3e352'));
                            }}
                            className="text-red-600"
                          >
                            {uiText('pages.admin-faqs-page.fc81e222b9')}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
