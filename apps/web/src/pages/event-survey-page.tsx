import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SurveyResponseAnswerDto, SurveyResponseState } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { matchesRestrictedCharacterPattern, SurveyApiError, surveyApi } from '@/lib/survey-api';

const text = (value: { value: string | null }) => value.value ?? '';
type SessionState = 'loading' | 'authenticated' | 'guest' | 'error';
const choiceTypes = (type: string) => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
function submissionUnavailableMessage(survey: Awaited<ReturnType<typeof surveyApi.get>>, session: SessionState, existingResponseState: SurveyResponseState | null, now = new Date()): string {
  if (session === 'loading') return '응답 정보를 불러오는 중...';
  if (session === 'error') return '로그인 상태를 확인할 수 없어 응답할 수 없습니다.';
  if (survey.state === 'ARCHIVED') return '보관된 설문입니다.';
  if (existingResponseState !== null) {
    if (existingResponseState !== 'SUBMITTED' || survey.editDeadlineAt === null || new Date(survey.editDeadlineAt).getTime() <= now.getTime()) return '응답 수정 기간이 마감되었습니다.';
  } else {
    if (survey.state === 'CLOSED' || survey.closesAt !== null && new Date(survey.closesAt).getTime() <= now.getTime()) return '마감된 설문입니다.';
    if (survey.state !== 'OPEN' || survey.opensAt !== null && new Date(survey.opensAt).getTime() > now.getTime()) return '아직 응답 기간이 아닙니다.';
  }
  if (session === 'guest' && survey.feeRestriction === 'PAID_ONLY') return '회비 납부 회원만 응답할 수 있습니다.';
  return session === 'guest' && !survey.guestAllowed ? '게스트 응답이 허용되지 않습니다.' : '';
}

function errorMessage(error: unknown, guest: boolean): string {
  if (error instanceof SurveyApiError) {
    if (guest && error.code === 'duplicate_response') return '요청을 처리할 수 없습니다.';
    switch (error.code) {
      case 'survey_cap_reached': return '응답 정원에 도달했습니다.';
      case 'duplicate_response': return '이미 이 설문에 응답했습니다.';
      case 'paid_only': return '회비 납부 회원만 응답할 수 있습니다.';
      case 'guest_not_allowed': return '게스트 응답이 허용되지 않습니다.';
      case 'invalid_answers': return '입력값이 설문 조건을 충족하지 않습니다.';
      case 'survey_closed': return '현재 응답할 수 없는 설문입니다.';
      case 'unauthorized': return '로그인이 필요합니다.';
      default: return error.status === 401 || error.status === 403 ? '로그인 또는 권한 확인이 필요합니다.' : error.status === 422 ? '입력값을 확인해 주세요.' : error.message;
    }
  }
  return error instanceof TypeError ? '네트워크 연결을 확인해 주세요.' : '요청 처리에 실패했습니다.';
}

export function EventSurveyPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<Awaited<ReturnType<typeof surveyApi.get>>>();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState<SessionState>('loading');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const routeToken = useRef(0);
  const [existingResponseState, setExistingResponseState] = useState<SurveyResponseState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = ++routeToken.current;
    setSurvey(undefined); setAnswers({}); setPhone(''); setError(''); setSuccess(''); setSubmitting(false); setExistingResponseState(null); submitLock.current = false; setSession('loading');
    if (!surveyId) { setError('유효하지 않은 설문 주소입니다.'); return () => controller.abort(); }
    void surveyApi.get(surveyId, undefined, controller.signal).then((value) => { if (token === routeToken.current) setSurvey(value); }).catch((cause: unknown) => { if (token === routeToken.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError('설문을 불러오지 못했습니다.'); });
    void surveyApi.session(controller.signal).then(async (value) => {
      if (token !== routeToken.current) return;
      if (!value.authenticated) { setSession('guest'); return; }
      const mine = await surveyApi.mine(surveyId, controller.signal);
      if (token !== routeToken.current) return;
      if (mine.response) {
        setExistingResponseState(mine.response.state);
        const initialAnswers: Record<string, string | string[]> = {};
        for (const answer of mine.response.answers) {
          if ('textValue' in answer && answer.textValue !== undefined) initialAnswers[answer.questionId] = answer.textValue;
          else if ('numberValue' in answer && answer.numberValue !== undefined) initialAnswers[answer.questionId] = String(answer.numberValue);
          else if ('dateValue' in answer && answer.dateValue !== undefined) initialAnswers[answer.questionId] = answer.dateValue;
          else if ('choiceOptionIds' in answer && answer.choiceOptionIds !== undefined) initialAnswers[answer.questionId] = answer.choiceOptionIds;
        }
        setAnswers(initialAnswers);
      }
      setSession('authenticated');
    }).catch((cause: unknown) => { if (token === routeToken.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setSession('error'); });
    return () => controller.abort();
  }, [surveyId]);

  const set = (id: string, value: string | string[]) => setAnswers((old) => ({ ...old, [id]: value }));
  const guestPhoneRequired = Boolean(survey?.phoneRequired && session === 'guest');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!survey || !surveyId || session === 'loading' || session === 'error' || submitLock.current || success) return;
    const unavailable = submissionUnavailableMessage(survey, session, existingResponseState);
    if (unavailable) { setError(unavailable); return; }
    setError(''); setSuccess('');
    if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); return; }
    const questions = survey.sections.flatMap((section) => section.questions);
    const missing = questions.find((question) => question.required && (!answers[question.id] || (Array.isArray(answers[question.id]) && !answers[question.id].length)));
    if (missing || (guestPhoneRequired && !phone.trim())) { setError(missing ? '필수 질문에 응답해 주세요.' : '전화번호를 입력해 주세요.'); return; }
    for (const question of questions) {
      const value = answers[question.id];
      if ((question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') && typeof value === 'string' && new TextEncoder().encode(value).byteLength > 8_192) {
        setError('텍스트 응답은 UTF-8 기준 8,192바이트를 초과할 수 없습니다.'); return;
      }
      if (typeof value === 'string' && question.validationRegex) {
        const regexMatch = matchesRestrictedCharacterPattern(question.validationRegex, value);
        if (regexMatch === null) { setError('이 질문의 형식 조건을 안전하게 확인할 수 없습니다. 관리자에게 문의해 주세요.'); return; }
        if (!regexMatch) { setError('입력값이 질문의 형식 조건을 충족하지 않습니다.'); return; }
      }
    }
    const payload = questions.reduce<SurveyResponseAnswerDto[]>((result, question) => {
      const value = answers[question.id];
      if (value === undefined || value === '') return result;
      if (question.type === 'NUMBER') result.push({ questionId: question.id, numberValue: Number(value) });
      else if (question.type === 'DATE') result.push({ questionId: question.id, dateValue: value as string });
      else if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') result.push({ questionId: question.id, choiceOptionIds: Array.isArray(value) ? value : [value] });
      else result.push({ questionId: question.id, textValue: value as string });
      return result;
    }, []);
    const token = routeToken.current;
    submitLock.current = true; setSubmitting(true);
    try {
      const result = await surveyApi.submit(surveyId, { answers: payload, ...(guestPhoneRequired ? { guestPhone: phone.trim() } : {}) });
      if (session === 'guest' ? !('status' in result) || result.status !== 'ACCEPTED' : !('response' in result)) throw new Error('Unexpected submission response.');
      if (token === routeToken.current) { setExistingResponseState(session === 'authenticated' ? 'SUBMITTED' : null); setSuccess('응답이 제출되었습니다.'); }
    }
    catch (cause) { if (token === routeToken.current) { submitLock.current = false; setError(errorMessage(cause, session === 'guest')); } }
    finally { if (token === routeToken.current) setSubmitting(false); }
  };

  if (error && !survey) return <SiteLayout><p role="alert" className="p-8">{error}</p></SiteLayout>;
  if (!survey) return <SiteLayout><p role="status" className="p-8">설문을 불러오는 중...</p></SiteLayout>;
  const unavailableMessage = success ? '' : submissionUnavailableMessage(survey, session, existingResponseState);
  const available = !unavailableMessage && !success;
  return <SiteLayout><div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8"><div className="mx-auto w-full px-[12vw]"><h1 className="text-[32px] font-extrabold text-white">설문조사</h1></div></div>
    <main className="mx-auto w-full px-[12vw] py-8"><h2 className="text-[28px] font-extrabold">{text(survey.title)}</h2><p className="mt-2">{survey.description ? text(survey.description) : ''}</p>
      {unavailableMessage && <p role={session === 'error' ? 'alert' : 'status'} className="mt-4 rounded bg-yellow-50 p-4">{unavailableMessage}</p>}
      <form onSubmit={submit}>{survey.sections.map((section) => <fieldset key={section.id} className="mt-6 rounded-[15px] bg-white p-7 shadow"><legend className="text-xl font-bold">{text(section.title)}</legend>{section.questions.map((question) => { const label = text(question.prompt); const value = answers[question.id]; const helpId = `survey-question-help-${question.id}`; const describedBy = question.helpText ? helpId : undefined; const input = question.type === 'LONG_TEXT' ? <textarea aria-label={label} aria-describedby={describedBy} disabled={!available} required={question.required} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 w-full border p-2" /> : question.type === 'SHORT_TEXT' ? <input aria-label={label} aria-describedby={describedBy} disabled={!available} required={question.required} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 w-full border p-2" /> : question.type === 'NUMBER' ? <input aria-label={label} aria-describedby={describedBy} type="number" disabled={!available} required={question.required} min={question.numberMin ?? undefined} max={question.numberMax ?? undefined} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 border p-2" /> : question.type === 'DATE' ? <input aria-label={label} aria-describedby={describedBy} type="date" disabled={!available} required={question.required} min={question.dateMin ?? undefined} max={question.dateMax ?? undefined} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 border p-2" /> : <fieldset aria-describedby={describedBy} className="mt-2 space-y-2"><legend className="font-semibold">{label}{question.required && ' *'}</legend>{question.choices.map((choice) => { const selected = (value as string[] | undefined) ?? []; return <label key={choice.id} className="block"><input disabled={!available} type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={question.id} required={question.required && question.type === 'SINGLE_CHOICE'} checked={question.type === 'SINGLE_CHOICE' ? value === choice.id : selected.includes(choice.id)} onChange={() => question.type === 'SINGLE_CHOICE' ? set(question.id, choice.id) : set(question.id, selected.includes(choice.id) ? selected.filter((id) => id !== choice.id) : [...selected, choice.id])} /> {text(choice.value)}</label>; })}</fieldset>; return <div key={question.id} className="mt-6">{!choiceTypes(question.type) && <label className="block font-semibold">{label} {question.required && <span className="text-red-600">*</span>}</label>}{question.helpText && <p id={helpId} className="text-sm text-kaist-grey">{text(question.helpText)}</p>}{input}</div>; })}</fieldset>)}
        {guestPhoneRequired && <label className="mt-6 block">전화번호<input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!available} className="ml-3 border p-2" /></label>}
        {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}{success && <p role="status" className="mt-4 text-green-700">{success}</p>}<div className="mt-8 flex justify-between"><Link to="/events">행사 목록으로</Link>{(available || success) && <button type="submit" disabled={submitting || Boolean(success)} className="rounded bg-kaist-darkgreen-main px-6 py-3 text-white">{success ? '제출 완료' : submitting ? '제출 중...' : '응답 제출'}</button>}</div>
      </form></main></SiteLayout>;
}
