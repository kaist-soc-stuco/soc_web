import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LocalizedContent, SurveyQuestionDto, SurveyResponseAnswerDto, SurveyResponseState } from '@soc/contracts';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, ImageIcon, Phone, Send, X } from 'lucide-react';

import { SiteLayout } from '@/components/organisms/site-layout';
import { useLocale } from '@/lib/locale-store';
import { formatScheduleRange } from '@/lib/schedule-date';
import { surveyApi } from '@/lib/survey-api';

const text = (value: LocalizedContent) => value.value ?? '';
const choice = (type: string) => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
type Answer = string | string[];
type SurveyDetail = Awaited<ReturnType<typeof surveyApi.get>>;

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
  const [survey, setSurvey] = useState<SurveyDetail>();
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
    setSurvey(undefined);
    setAnswers({});
    setPhone('');
    setError('');
    setInvalid({});
    setSubmitted(false);
    setSubmitting(false);
    setExistingState(null);
    setGuest(true);
  }, [surveyId]);

  useEffect(() => {
    if (!surveyId) return;
    let active = true;
    void surveyApi
      .get(surveyId, locale)
      .then((next) => {
        if (active) setSurvey(next);
      })
      .catch(() => active && setError(locale === 'ko' ? '설문을 불러오지 못했습니다.' : 'Unable to load this survey.'));
    return () => {
      active = false;
    };
  }, [surveyId, locale]);

  useEffect(() => {
    if (!surveyId) return;
    let active = true;
    void surveyApi
      .session()
      .then((session) => {
        if (!active) return;
        setGuest(!session.authenticated);
        if (!session.authenticated) return;
        void surveyApi
          .mine(surveyId)
          .then((mine) => {
            if (!active || !mine.response) return;
            setExistingState(mine.response.state);
            setAnswers(responseAnswers(mine.response));
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [surveyId]);

  useEffect(() => {
    if (!lightbox) return;
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(undefined);
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) opener.current?.focus();
  }, [lightbox]);

  if (!survey) {
    return (
      <SiteLayout>
        <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC] px-6 py-12">
          <p role={error ? 'alert' : 'status'} className={`mx-auto max-w-3xl rounded-[8px] border bg-white p-10 text-center font-semibold shadow-[0_12px_32px_rgba(57,64,75,0.06)] ${error ? 'border-red-200 text-red-700' : 'border-kaist-grey/20 text-kaist-grey'}`}>
            {error || (locale === 'ko' ? '불러오는 중...' : 'Loading...')}
          </p>
        </div>
      </SiteLayout>
    );
  }

  const questions = survey.sections.flatMap((section) => section.items.flatMap((item) => (item.kind === 'QUESTION' ? [item.question] : [])));
  const now = new Date();
  const editOpen = existingState === 'SUBMITTED' && survey.editDeadlineAt !== null && new Date(survey.editDeadlineAt) > now;
  const openForNewResponse = survey.state === 'OPEN' && (!survey.opensAt || new Date(survey.opensAt) <= now) && (!survey.closesAt || new Date(survey.closesAt) > now) && (!guest || survey.guestAllowed);
  const available = editOpen || (existingState === null && openForNewResponse);
  const set = (id: string, next: Answer) => {
    setAnswers((old) => ({ ...old, [id]: next }));
    setInvalid((old) => {
      const { [id]: _, ...rest } = old;
      return rest;
    });
  };
  const validate = () => {
    const next: Record<string, string> = {};
    for (const question of questions) {
      const answer = answers[question.id];
      const empty = answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);
      if (question.required && empty) next[question.id] = locale === 'ko' ? '필수 질문입니다.' : 'This question is required.';
      else if (!empty && question.type === 'NUMBER') {
        const value = Number(answer);
        if (!Number.isFinite(value) || (question.numberMin !== null && value < question.numberMin) || (question.numberMax !== null && value > question.numberMax)) next[question.id] = locale === 'ko' ? '올바른 숫자를 입력해 주세요.' : 'Enter a valid number.';
      } else if (!empty && question.type === 'DATE' && ((question.dateMin && (answer as string) < question.dateMin) || (question.dateMax && (answer as string) > question.dateMax))) {
        next[question.id] = locale === 'ko' ? '올바른 날짜를 입력해 주세요.' : 'Enter a valid date.';
      } else if (!empty && question.validationRegex) {
        try {
          if (!new RegExp(question.validationRegex).test(Array.isArray(answer) ? answer.join(',') : answer)) next[question.id] = locale === 'ko' ? '입력 형식을 확인해 주세요.' : 'Enter a valid response.';
        } catch {
          // Server-owned invalid patterns must not make the form unusable.
        }
      }
    }
    if (guest && survey.phoneRequired && !phone.trim()) next.phone = locale === 'ko' ? '전화번호를 입력해 주세요.' : 'Phone is required.';
    setInvalid(next);
    const first = Object.keys(next)[0];
    if (first) {
      fields.current[first]?.focus();
      return false;
    }
    return true;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!surveyId || submitting || submitted || !available || !validate()) return;
    setSubmitting(true);
    setError('');
    const payload = questions.reduce<SurveyResponseAnswerDto[]>((all, question) => {
      const answer = answers[question.id];
      if (answer === undefined || answer === '' || (Array.isArray(answer) && !answer.length)) return all;
      if (question.type === 'NUMBER') all.push({ questionId: question.id, numberValue: Number(answer) });
      else if (question.type === 'DATE') all.push({ questionId: question.id, dateValue: answer as string });
      else if (choice(question.type)) all.push({ questionId: question.id, choiceOptionIds: Array.isArray(answer) ? answer : [answer] });
      else all.push({ questionId: question.id, textValue: answer as string });
      return all;
    }, []);
    try {
      const result = await surveyApi.submit(surveyId, { answers: payload, ...(guest && survey.phoneRequired ? { guestPhone: phone.trim() } : {}) });
      if (guest) setSubmitted(true);
      else if ('response' in result) setExistingState(result.response.state);
    } catch {
      setError(locale === 'ko' ? '응답을 제출하지 못했습니다.' : 'Unable to submit your response.');
    } finally {
      setSubmitting(false);
    }
  };
  const unavailable = !available
    ? existingState !== null
      ? locale === 'ko'
        ? '응답 수정 기간이 종료되었습니다.'
        : 'Response editing is no longer available.'
      : !guest || survey.guestAllowed
        ? locale === 'ko'
          ? '현재 참여할 수 없는 설문입니다.'
          : 'This survey is not currently available.'
        : locale === 'ko'
          ? '로그인해야 설문에 참여할 수 있습니다.'
          : 'Sign in to respond to this survey.'
    : '';
  const questionNumbers = new Map(questions.map((question, index) => [question.id, index + 1]));
  const schedule = formatScheduleRange(survey.opensAt, survey.closesAt);

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link to="/events?type=survey" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-kaist-darkgreen transition hover:text-kaist-darkgreen-main">
            <ArrowLeft className="h-4 w-4" />
            {locale === 'ko' ? '설문 목록' : 'Survey list'}
          </Link>

          <section className="overflow-hidden rounded-[8px] border border-kaist-grey/15 bg-white shadow-[0_20px_70px_rgba(57,64,75,0.10)]" aria-labelledby="survey-title">
            <div className="h-4 bg-[linear-gradient(90deg,#006B4A_0%,#8DCDAE_100%)]" />
            <div className="p-7 md:p-9">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-kaist-darkgreen/15 bg-kaist-lightgreen2/25 px-3 py-1.5 text-xs font-extrabold text-kaist-darkgreen">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {locale === 'ko' ? '설문조사' : 'Survey'}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                  {existingState === 'SUBMITTED' ? (locale === 'ko' ? '응답 수정' : 'Editing response') : (locale === 'ko' ? '진행 중' : 'Open')}
                </span>
              </div>
              <h1 id="survey-title" className="mt-5 break-words text-[32px] font-extrabold leading-tight tracking-tight text-kaist-black md:text-[38px]">{text(survey.title)}</h1>
              {survey.description && <p className="mt-5 whitespace-pre-wrap border-t border-kaist-grey/15 pt-5 text-base font-medium leading-8 text-kaist-grey">{text(survey.description)}</p>}
              {schedule && <p className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-kaist-greygreen"><CalendarDays className="h-4 w-4 text-kaist-darkgreen" />{locale === 'ko' ? '응답 기간' : 'Response period'} · {schedule}</p>}
            </div>
          </section>

          {survey.onlyForKoreanSpeaker && locale === 'en' && <p role="status" className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">This survey is available in Korean. Korean content is shown below.</p>}

          {submitted ? (
            <section className="mt-6 rounded-[8px] border border-emerald-200 bg-white p-10 text-center shadow-[0_12px_32px_rgba(57,64,75,0.06)]" role="status">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-4 text-2xl font-extrabold text-kaist-black">{locale === 'ko' ? '응답을 제출했습니다.' : 'Response submitted.'}</h2>
              <p className="mt-2 text-sm font-medium text-kaist-grey">{locale === 'ko' ? '참여해 주셔서 감사합니다.' : 'Thank you for participating.'}</p>
            </section>
          ) : unavailable ? (
            <p role="status" className="mt-6 rounded-[8px] border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-900">{unavailable}</p>
          ) : (
            <form onSubmit={submit} noValidate className="mt-7 space-y-8">
              {survey.sections.map((section) => (
                <section key={section.id} aria-labelledby={`survey-section-${section.id}`}>
                  <div className="mb-3 px-1">
                    <h2 id={`survey-section-${section.id}`} className="text-xl font-extrabold tracking-tight text-kaist-black">{text(section.title)}</h2>
                  </div>
                  <div className="space-y-4">
                    {section.items.map((item) =>
                      item.kind === 'DESCRIPTION' ? (
                        <p key={item.id} className="whitespace-pre-wrap rounded-[8px] border border-kaist-lightgreen2/40 bg-kaist-lightgreen2/15 px-5 py-4 text-sm font-medium leading-6 text-kaist-black">{text(item.body)}</p>
                      ) : item.kind === 'IMAGE_BLOCK' ? (
                        <ImageCarousel key={item.id} surveyId={survey.id} blockId={item.id} locale={locale} set={item.mode === 'SHARED' ? 'SHARED' : survey.effectiveContentLocale === 'ko' ? 'KO' : 'EN'} onOpen={(src, target) => { opener.current = target; setLightbox(src); }} />
                      ) : (
                        <Question key={item.id} index={questionNumbers.get(item.question.id) ?? 1} question={item.question} value={answers[item.question.id]} invalid={invalid[item.question.id]} fieldRef={(node) => { fields.current[item.question.id] = node; }} set={set} />
                      ),
                    )}
                  </div>
                </section>
              ))}

              {guest && survey.phoneRequired && (
                <div className="rounded-[8px] border border-kaist-grey/20 bg-white p-5 shadow-[0_10px_28px_rgba(57,64,75,0.05)]">
                  <label className="block text-sm font-extrabold text-kaist-black" htmlFor="survey-phone"><span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-kaist-darkgreen" />{locale === 'ko' ? '전화번호' : 'Phone'}<span aria-hidden="true" className="text-rose-500">*</span></span></label>
                  <input id="survey-phone" type="tel" ref={(node) => { fields.current.phone = node; }} aria-invalid={Boolean(invalid.phone)} aria-describedby={invalid.phone ? 'phone-error' : undefined} value={phone} onChange={(event) => { setPhone(event.target.value); setInvalid((old) => { const { phone: _, ...rest } = old; return rest; }); }} className="mt-3 min-h-11 w-full rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15" />
                  {invalid.phone && <span id="phone-error" role="alert" className="mt-2 block text-sm font-semibold text-rose-600">{invalid.phone}</span>}
                </div>
              )}

              {error && <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="flex justify-end border-t border-kaist-grey/15 pt-5">
                <button type="submit" disabled={submitting} className="inline-flex min-h-12 min-w-32 items-center justify-center gap-2 rounded-[5px] bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-kaist-darkgreen2 focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  {submitting ? (locale === 'ko' ? '제출 중...' : 'Submitting...') : (locale === 'ko' ? '제출' : 'Submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label={locale === 'ko' ? '이미지 미리보기' : 'Image preview'} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(undefined); }}>
          <div className="relative h-[90vh] w-[90vw]" data-testid="lightbox-container">
            <button ref={closeButton} type="button" aria-label={locale === 'ko' ? '이미지 닫기' : 'Close image'} className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80" onClick={() => setLightbox(undefined)}>
              <X className="h-5 w-5" />
            </button>
            <img src={lightbox} alt="" className="h-full w-full object-contain" />
          </div>
        </div>
      )}
    </SiteLayout>
  );
}

function Question({ index, question, value, invalid, fieldRef, set }: { index: number; question: SurveyQuestionDto; value: Answer | undefined; invalid?: string; fieldRef: (node: HTMLElement | null) => void; set: (id: string, value: Answer) => void }) {
  const label = text(question.prompt);
  const described = invalid ? `${question.id}-error` : undefined;
  const heading = (
    <>
      <span aria-hidden="true" className="text-kaist-darkgreen">{index}.</span>
      <span>{label}</span>
      {question.required && <span aria-hidden="true" className="text-rose-500">*</span>}
    </>
  );
  const help = question.helpText ? text(question.helpText) : '';
  const cardClass = `rounded-[8px] border bg-white p-5 shadow-[0_10px_28px_rgba(57,64,75,0.05)] transition ${invalid ? 'border-rose-300 ring-2 ring-rose-100' : 'border-kaist-grey/20 focus-within:border-kaist-darkgreen/40'}`;
  if (choice(question.type)) {
    return (
      <fieldset className={cardClass} aria-invalid={Boolean(invalid)} aria-describedby={described}>
        <legend className="flex max-w-full items-start gap-2 px-1 text-base font-extrabold leading-6 text-kaist-black">{heading}</legend>
        {help && <p className="mt-2 text-sm font-medium text-kaist-grey">{help}</p>}
        <div className="mt-4 grid gap-2.5">
          {question.choices.map((option, optionIndex) => (
            <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[5px] border border-kaist-grey/20 px-4 py-3 text-sm font-medium text-kaist-black transition hover:border-kaist-darkgreen/30 hover:bg-kaist-lightgreen2/10">
              <input ref={optionIndex === 0 ? fieldRef : undefined} type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={question.id} checked={question.type === 'SINGLE_CHOICE' ? value === option.id : Array.isArray(value) && value.includes(option.id)} onChange={() => question.type === 'SINGLE_CHOICE' ? set(question.id, option.id) : set(question.id, Array.isArray(value) && value.includes(option.id) ? value.filter((id) => id !== option.id) : [...(Array.isArray(value) ? value : []), option.id])} className="h-4 w-4 shrink-0 accent-kaist-darkgreen" />
              <span>{text(option.value)}</span>
            </label>
          ))}
        </div>
        {invalid && <p id={described} role="alert" className="mt-3 text-sm font-semibold text-rose-600">{invalid}</p>}
      </fieldset>
    );
  }
  const inputClass = 'mt-4 min-h-11 w-full rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-3 text-sm font-medium text-kaist-black outline-none transition placeholder:text-kaist-grey/50 focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15';
  return (
    <div className={cardClass}>
      <label className="flex items-start gap-2 text-base font-extrabold leading-6 text-kaist-black">{heading}</label>
      {help && <p className="mt-2 text-sm font-medium text-kaist-grey">{help}</p>}
      {question.type === 'LONG_TEXT' ? (
        <textarea aria-label={label} ref={fieldRef as never} aria-invalid={Boolean(invalid)} aria-describedby={described} value={(value as string) ?? ''} onChange={(event) => set(question.id, event.target.value)} rows={5} className={`${inputClass} resize-y`} />
      ) : (
        <input aria-label={label} ref={fieldRef as never} type={question.type === 'NUMBER' ? 'number' : question.type === 'DATE' ? 'date' : 'text'} min={question.type === 'NUMBER' ? question.numberMin ?? undefined : question.type === 'DATE' ? question.dateMin ?? undefined : undefined} max={question.type === 'NUMBER' ? question.numberMax ?? undefined : question.type === 'DATE' ? question.dateMax ?? undefined : undefined} aria-invalid={Boolean(invalid)} aria-describedby={described} value={(value as string) ?? ''} onChange={(event) => set(question.id, event.target.value)} className={inputClass} />
      )}
      {invalid && <span id={described} role="alert" className="mt-2 block text-sm font-semibold text-rose-600">{invalid}</span>}
    </div>
  );
}

function ImageCarousel({ surveyId, blockId, locale, set, onOpen }: { surveyId: string; blockId: string; locale: 'ko' | 'en'; set: 'SHARED' | 'KO' | 'EN'; onOpen: (src: string, target: HTMLElement) => void }) {
  const [images, setImages] = useState<Array<{ id: string; src: string }>>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const token = useRef(0);
  const loadingCursor = useRef<string | undefined | null>(null);
  const pendingPage = useRef<number | null>(null);

  const load = async (cursor?: string) => {
    if (loadingCursor.current !== null && loadingCursor.current === cursor) return;
    loadingCursor.current = cursor;
    const current = ++token.current;
    setLoading(true);
    setError('');
    try {
      const result = await surveyApi.publicImageMemberships(surveyId, blockId, { set, locale, limit: 20, ...(cursor ? { cursor } : {}) });
      if (current !== token.current) return;
      setImages((old) => (cursor ? [...old, ...result.items.map((item) => ({ id: item.id, src: item.asset.src }))] : result.items.map((item) => ({ id: item.id, src: item.asset.src }))));
      setTotal(result.membershipCount);
      setNextCursor(result.nextCursor);
    } catch {
      if (current === token.current) setError(locale === 'ko' ? '이미지를 불러오지 못했습니다.' : 'Unable to load images.');
    } finally {
      if (current === token.current) {
        loadingCursor.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setImages([]);
    setPage(0);
    setTotal(0);
    setNextCursor(null);
    pendingPage.current = null;
    void load();
    return () => {
      token.current += 1;
      loadingCursor.current = null;
    };
  }, [surveyId, blockId, locale, set]);

  useEffect(() => {
    const target = pendingPage.current;
    if (target === null || target >= images.length) return;
    pendingPage.current = null;
    ref.current?.children[target]?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setPage(target);
  }, [images]);

  const visible = () => {
    const container = ref.current;
    if (!container) return;
    const index = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1));
    setPage(Math.max(0, Math.min(images.length - 1, index)));
    if (index >= images.length - 1 && nextCursor) void load(nextCursor);
  };
  if (loading && !images.length) return <p role="status" className="rounded-[8px] border border-kaist-grey/20 bg-white p-5 text-sm font-semibold text-kaist-grey">{locale === 'ko' ? '이미지 불러오는 중...' : 'Loading images...'}</p>;
  if (error && !images.length) return <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></p>;
  if (!images.length) return null;
  const go = (next: number) => {
    if (next >= images.length && nextCursor) {
      pendingPage.current = next;
      void load(nextCursor);
      return;
    }
    const index = Math.max(0, Math.min(images.length - 1, next));
    ref.current?.children[index]?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setPage(index);
    if (index === images.length - 1 && nextCursor) void load(nextCursor);
  };
  return (
    <div className="overflow-hidden rounded-[8px] border border-kaist-grey/20 bg-white p-4 shadow-[0_10px_28px_rgba(57,64,75,0.05)]" onKeyDown={(event) => { if (event.key === 'ArrowLeft') go(page - 1); if (event.key === 'ArrowRight') go(page + 1); }}>
      <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-kaist-black"><ImageIcon className="h-4 w-4 text-kaist-darkgreen" />{locale === 'ko' ? '참고 이미지' : 'Reference images'}</div>
      <div ref={ref} onScroll={visible} className="flex snap-x snap-mandatory overflow-x-auto rounded-[5px] bg-slate-50">
        {images.map((image, index) => (
          <button key={image.id} type="button" aria-label={locale === 'ko' ? `이미지 ${index + 1} 열기` : `Open image ${index + 1}`} className="aspect-[16/9] w-full shrink-0 snap-center overflow-hidden" onClick={(event) => onOpen(image.src, event.currentTarget)}>
            <img src={image.src} alt="" loading="lazy" className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" aria-label={locale === 'ko' ? '이전 이미지' : 'Previous image'} disabled={page === 0} onClick={() => go(page - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-kaist-grey/20 text-kaist-darkgreen transition hover:bg-kaist-grey/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <span aria-live="polite" className="min-w-14 text-center text-xs font-bold text-kaist-grey">{page + 1} / {total}</span>
        <button type="button" aria-label={locale === 'ko' ? '다음 이미지' : 'Next image'} disabled={page >= total - 1} onClick={() => go(page + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-kaist-grey/20 text-kaist-darkgreen transition hover:bg-kaist-grey/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error} <button type="button" className="underline" onClick={() => void load(nextCursor ?? undefined)}>{locale === 'ko' ? '다시 시도' : 'Retry'}</button></p>}
    </div>
  );
}
