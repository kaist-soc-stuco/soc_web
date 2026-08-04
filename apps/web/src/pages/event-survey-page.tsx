import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LocalizedContent, SurveyQuestionDto, SurveyResponseAnswerDto, SurveyResponseState } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { useLocale } from '@/lib/locale-store';
import { surveyApi } from '@/lib/survey-api';

const text = (value: LocalizedContent) => value.value ?? '';
const choice = (type: string) => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
type Answer = string | string[];

function responseAnswers(response: Awaited<ReturnType<typeof surveyApi.mine>>['response']): Record<string, Answer> {
  if (!response) return {};
  return response.answers.reduce<Record<string, Answer>>((answers, answer) => {
    if ('textValue' in answer && answer.textValue !== undefined) answers[answer.questionId] = answer.textValue;
    else if ('numberValue' in answer && answer.numberValue !== undefined) answers[answer.questionId] = String(answer.numberValue);
    else if ('dateValue' in answer && answer.dateValue !== undefined) answers[answer.questionId] = answer.dateValue;
    else if ('choiceOptionIds' in answer && answer.choiceOptionIds !== undefined) answers[answer.questionId] = answer.choiceOptionIds;
    return answers;
  }, {});
}

export function EventSurveyPage() {
  const [locale] = useLocale();
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<Awaited<ReturnType<typeof surveyApi.get>>>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingState, setExistingState] = useState<SurveyResponseState | null>(null);
  const [guest, setGuest] = useState(true);
  const [lightbox, setLightbox] = useState<string>();
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const fields = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setSurvey(undefined); setAnswers({}); setPhone(''); setError(''); setInvalid({}); setSubmitted(false); setSubmitting(false); setExistingState(null); setGuest(true);
  }, [surveyId]);
  useEffect(() => {
    if (!surveyId) return;
    let active = true;
    void surveyApi.get(surveyId, locale).then((next) => { if (active) setSurvey(next); }).catch(() => active && setError('설문을 불러올 수 없습니다.'));
    return () => { active = false; };
  }, [surveyId, locale]);
  useEffect(() => {
    if (!surveyId) return;
    let active = true;
    void surveyApi.session().then((session) => {
      if (!active) return;
      setGuest(!session.authenticated);
      if (!session.authenticated) return;
      void surveyApi.mine(surveyId).then((mine) => {
        if (!active || !mine.response) return;
        setExistingState(mine.response.state);
        setAnswers(responseAnswers(mine.response));
      }).catch(() => undefined);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [surveyId]);
  useEffect(() => {
    if (!lightbox) return;
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(undefined);
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [lightbox]);
  useEffect(() => { if (!lightbox) opener.current?.focus(); }, [lightbox]);

  if (!survey) return <SiteLayout><p role="status">{error || '불러오는 중…'}</p></SiteLayout>;
  const questions = survey.sections.flatMap((section) => section.items.flatMap((item) => item.kind === 'QUESTION' ? [item.question] : []));
  const now = new Date();
  const editOpen = existingState === 'SUBMITTED' && survey.editDeadlineAt !== null && new Date(survey.editDeadlineAt) > now;
  const openForNewResponse = survey.state === 'OPEN' && (!survey.opensAt || new Date(survey.opensAt) <= now) && (!survey.closesAt || new Date(survey.closesAt) > now) && (!guest || survey.guestAllowed);
  const available = editOpen || existingState === null && openForNewResponse;
  const set = (id: string, next: Answer) => { setAnswers((old) => ({ ...old, [id]: next })); setInvalid((old) => { const { [id]: _, ...rest } = old; return rest; }); };
  const validate = () => {
    const next: Record<string, string> = {};
    for (const question of questions) {
      const answer = answers[question.id]; const empty = answer === undefined || answer === '' || Array.isArray(answer) && answer.length === 0;
      if (question.required && empty) next[question.id] = 'This question is required.';
      else if (!empty && question.type === 'NUMBER') { const value = Number(answer); if (!Number.isFinite(value) || question.numberMin !== null && value < question.numberMin || question.numberMax !== null && value > question.numberMax) next[question.id] = 'Enter a valid number.'; }
      else if (!empty && question.type === 'DATE' && (question.dateMin && (answer as string) < question.dateMin || question.dateMax && (answer as string) > question.dateMax)) next[question.id] = 'Enter a valid date.';
      else if (!empty && question.validationRegex) { try { if (!new RegExp(question.validationRegex).test(Array.isArray(answer) ? answer.join(',') : answer)) next[question.id] = 'Enter a valid response.'; } catch { /* Server-owned invalid patterns must not make the form unusable. */ } }
    }
    if (guest && survey.phoneRequired && !phone.trim()) next.phone = 'Phone is required.';
    setInvalid(next); const first = Object.keys(next)[0]; if (first) { fields.current[first]?.focus(); return false; } return true;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!surveyId || submitting || submitted || !available || !validate()) return;
    setSubmitting(true); setError('');
    const payload = questions.reduce<SurveyResponseAnswerDto[]>((all, question) => {
      const answer = answers[question.id]; if (answer === undefined || answer === '' || Array.isArray(answer) && !answer.length) return all;
      if (question.type === 'NUMBER') all.push({ questionId: question.id, numberValue: Number(answer) });
      else if (question.type === 'DATE') all.push({ questionId: question.id, dateValue: answer as string });
      else if (choice(question.type)) all.push({ questionId: question.id, choiceOptionIds: Array.isArray(answer) ? answer : [answer] });
      else all.push({ questionId: question.id, textValue: answer as string }); return all;
    }, []);
    try { const result = await surveyApi.submit(surveyId, { answers: payload, ...(guest && survey.phoneRequired ? { guestPhone: phone.trim() } : {}) }); if (guest) setSubmitted(true); else if ('response' in result) setExistingState(result.response.state); }
    catch { setError('응답을 제출하지 못했습니다.'); } finally { setSubmitting(false); }
  };
  const unavailable = !available ? existingState !== null ? 'Response editing is no longer available.' : !guest || survey.guestAllowed ? 'This survey is not currently available.' : 'Sign in to respond to this survey.' : '';
  return <SiteLayout><main className="mx-auto max-w-3xl p-6"><h1>{text(survey.title)}</h1>{survey.onlyForKoreanSpeaker && locale === 'en' && <p role="status">This survey is available in Korean. Korean content is shown below.</p>}{survey.description && <p>{text(survey.description)}</p>}{submitted ? <p role="status">{locale === 'ko' ? '응답이 제출되었습니다.' : 'Response submitted.'}</p> : unavailable ? <p role="status">{unavailable}</p> : <form onSubmit={submit} noValidate>{survey.sections.map((section) => <section key={section.id} className="mt-6"><h2>{text(section.title)}</h2>{section.items.map((item) => item.kind === 'DESCRIPTION' ? <p key={item.id} className="whitespace-pre-wrap">{text(item.body)}</p> : item.kind === 'IMAGE_BLOCK' ? <ImageCarousel key={item.id} surveyId={survey.id} blockId={item.id} locale={locale} set={item.mode === 'SHARED' ? 'SHARED' : survey.effectiveContentLocale === 'ko' ? 'KO' : 'EN'} onOpen={(src, target) => { opener.current = target; setLightbox(src); }} /> : <Question key={item.id} question={item.question} value={answers[item.question.id]} invalid={invalid[item.question.id]} fieldRef={(node) => { fields.current[item.question.id] = node; }} set={set} />)}</section>)}{guest && survey.phoneRequired && <label>Phone<input ref={(node) => { fields.current.phone = node; }} aria-invalid={Boolean(invalid.phone)} aria-describedby={invalid.phone ? 'phone-error' : undefined} value={phone} onChange={(event) => { setPhone(event.target.value); setInvalid((old) => { const { phone: _, ...rest } = old; return rest; }); }} />{invalid.phone && <span id="phone-error" role="alert">{invalid.phone}</span>}</label>}<button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>{error && <p role="alert">{error}</p>}</form>}</main>{lightbox && <div role="dialog" aria-modal="true" aria-label="Image preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(undefined); }}><div className="h-[90vh] w-[90vw]" data-testid="lightbox-container"><button ref={closeButton} type="button" aria-label="Close image" className="absolute right-4 top-4 text-white" onClick={() => setLightbox(undefined)}>×</button><img src={lightbox} alt="" className="h-full w-full object-contain" /></div></div>}</SiteLayout>;
}

function Question({ question, value, invalid, fieldRef, set }: { question: SurveyQuestionDto; value: Answer | undefined; invalid?: string; fieldRef: (node: HTMLElement | null) => void; set: (id: string, value: Answer) => void }) {
  const label = text(question.prompt); const described = invalid ? `${question.id}-error` : undefined;
  if (choice(question.type)) return <fieldset className="mt-4" aria-invalid={Boolean(invalid)} aria-describedby={described}><legend>{label}</legend>{question.choices.map((option, index) => <label key={option.id}><input ref={index === 0 ? fieldRef : undefined} type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={question.id} checked={question.type === 'SINGLE_CHOICE' ? value === option.id : Array.isArray(value) && value.includes(option.id)} onChange={() => question.type === 'SINGLE_CHOICE' ? set(question.id, option.id) : set(question.id, Array.isArray(value) && value.includes(option.id) ? value.filter((id) => id !== option.id) : [...(Array.isArray(value) ? value : []), option.id])} />{text(option.value)}</label>)}{invalid && <p id={described} role="alert">{invalid}</p>}</fieldset>;
  return <label className="mt-4 block">{label}{question.type === 'LONG_TEXT' ? <textarea ref={fieldRef as never} aria-invalid={Boolean(invalid)} aria-describedby={described} value={(value as string) ?? ''} onChange={(event) => set(question.id, event.target.value)} /> : <input ref={fieldRef as never} type={question.type === 'NUMBER' ? 'number' : question.type === 'DATE' ? 'date' : 'text'} min={question.type === 'NUMBER' ? question.numberMin ?? undefined : question.type === 'DATE' ? question.dateMin ?? undefined : undefined} max={question.type === 'NUMBER' ? question.numberMax ?? undefined : question.type === 'DATE' ? question.dateMax ?? undefined : undefined} aria-invalid={Boolean(invalid)} aria-describedby={described} value={(value as string) ?? ''} onChange={(event) => set(question.id, event.target.value)} />} {invalid && <span id={described} role="alert">{invalid}</span>}</label>;
}

function ImageCarousel({ surveyId, blockId, locale, set, onOpen }: { surveyId: string; blockId: string; locale: 'ko' | 'en'; set: 'SHARED' | 'KO' | 'EN'; onOpen: (src: string, target: HTMLElement) => void }) {
  const [images, setImages] = useState<Array<{ id: string; src: string }>>([]); const [page, setPage] = useState(0); const [total, setTotal] = useState(0); const [nextCursor, setNextCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null); const token = useRef(0); const loadingCursor = useRef<string | undefined | null>(null); const pendingPage = useRef<number | null>(null);
  const load = async (cursor?: string) => { if (loadingCursor.current !== null && loadingCursor.current === cursor) return; loadingCursor.current = cursor; const current = ++token.current; setLoading(true); setError(''); try { const result = await surveyApi.publicImageMemberships(surveyId, blockId, { set, locale, limit: 20, ...(cursor ? { cursor } : {}) }); if (current !== token.current) return; setImages((old) => cursor ? [...old, ...result.items.map((item) => ({ id: item.id, src: item.asset.src }))] : result.items.map((item) => ({ id: item.id, src: item.asset.src }))); setTotal(result.membershipCount); setNextCursor(result.nextCursor); } catch { if (current === token.current) setError(locale === 'ko' ? '이미지를 불러오지 못했습니다.' : 'Unable to load images.'); } finally { if (current === token.current) { loadingCursor.current = null; setLoading(false); } } };
  useEffect(() => { setImages([]); setPage(0); setTotal(0); setNextCursor(null); pendingPage.current = null; void load(); return () => { token.current += 1; loadingCursor.current = null; }; }, [surveyId, blockId, locale, set]);
  useEffect(() => { const target = pendingPage.current; if (target === null || target >= images.length) return; pendingPage.current = null; ref.current?.children[target]?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' }); setPage(target); }, [images]);
  const visible = () => { const container = ref.current; if (!container) return; const index = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1)); setPage(Math.max(0, Math.min(images.length - 1, index))); if (index >= images.length - 1 && nextCursor) void load(nextCursor); };
  if (loading && !images.length) return <p role="status">{locale === 'ko' ? '이미지 불러오는 중…' : 'Loading images…'}</p>;
  if (error && !images.length) return <p role="alert">{error} <button type="button" onClick={() => void load()}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></p>;
  if (!images.length) return null;
  const go = (next: number) => { if (next >= images.length && nextCursor) { pendingPage.current = next; void load(nextCursor); return; } const index = Math.max(0, Math.min(images.length - 1, next)); ref.current?.children[index]?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' }); setPage(index); if (index === images.length - 1 && nextCursor) void load(nextCursor); };
  return <div className="mt-4" onKeyDown={(event) => { if (event.key === 'ArrowLeft') go(page - 1); if (event.key === 'ArrowRight') go(page + 1); }}><div ref={ref} onScroll={visible} className="flex snap-x snap-mandatory overflow-x-auto">{images.map((image, index) => <button key={image.id} type="button" aria-label={locale === 'ko' ? `이미지 ${index + 1} 열기` : `Open image ${index + 1}`} className="w-full shrink-0 snap-center" onClick={(event) => onOpen(image.src, event.currentTarget)}><img src={image.src} alt="" loading="lazy" className="w-full" /></button>)}</div><button type="button" aria-label={locale === 'ko' ? '이전 이미지' : 'Previous image'} disabled={page === 0} onClick={() => go(page - 1)}>←</button><span aria-live="polite">{page + 1} / {total}</span><button type="button" aria-label={locale === 'ko' ? '다음 이미지' : 'Next image'} disabled={page >= total - 1} onClick={() => go(page + 1)}>→</button>{error && <p role="alert">{error} <button type="button" onClick={() => void load(nextCursor ?? undefined)}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></p>}</div>;
}
