import { uiText } from "@/lib/i18n/surface-catalog";
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SurveyResponseAnswerDto, SurveyResponseState } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { RelatedContentCards } from '@/components/organisms/related-content-cards';
import { useLocale } from '@/lib/locale-store';
import { matchesRestrictedCharacterPattern, SurveyApiError, surveyApi } from '@/lib/survey-api';
const text = (value: {
    value: string | null;
}) => value.value ?? '';
type SessionState = 'loading' | 'authenticated' | 'guest' | 'error';
const choiceTypes = (type: string) => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
function submissionUnavailableMessage(survey: Awaited<ReturnType<typeof surveyApi.get>>, session: SessionState, existingResponseState: SurveyResponseState | null, now = new Date()): string {
    if (session === 'loading')
        return uiText("pages.event-survey-page.c1973f1d4e");
    if (session === 'error')
        return uiText("pages.event-survey-page.7701b912de");
    if (survey.state === 'ARCHIVED')
        return uiText("pages.event-survey-page.711120c50b");
    if (existingResponseState !== null) {
        if (existingResponseState !== 'SUBMITTED' || survey.editDeadlineAt === null || new Date(survey.editDeadlineAt).getTime() <= now.getTime())
            return uiText("pages.event-survey-page.d062961bf4");
    }
    else {
        if (survey.state === 'CLOSED' || survey.closesAt !== null && new Date(survey.closesAt).getTime() <= now.getTime())
            return uiText("pages.event-survey-page.0406923853");
        if (survey.state !== 'OPEN' || survey.opensAt !== null && new Date(survey.opensAt).getTime() > now.getTime())
            return uiText("pages.event-survey-page.683ee921ab");
    }
    if (session === 'guest' && survey.feeRestriction === 'PAID_ONLY')
        return uiText("pages.event-survey-page.547b2f13c2");
    return session === 'guest' && !survey.guestAllowed ? uiText("pages.event-survey-page.8d9275eb9d") : '';
}
function errorMessage(error: unknown, guest: boolean): string {
    if (error instanceof SurveyApiError) {
        if (guest && error.code === 'duplicate_response')
            return uiText("pages.event-survey-page.efb9cd7e71");
        switch (error.code) {
            case 'survey_cap_reached': return uiText("pages.event-survey-page.53e1087f87");
            case 'duplicate_response': return uiText("pages.event-survey-page.8d0fc8bdff");
            case 'paid_only': return uiText("pages.event-survey-page.547b2f13c2");
            case 'guest_not_allowed': return uiText("pages.event-survey-page.8d9275eb9d");
            case 'invalid_answers': return uiText("pages.event-survey-page.39c7bfe714");
            case 'survey_closed': return uiText("pages.event-survey-page.f82cdb5645");
            case 'unauthorized': return uiText("pages.event-survey-page.5271ee34a5");
            default: return error.status === 401 || error.status === 403 ? uiText("pages.event-survey-page.11d62e1aaf") : error.status === 422 ? uiText("pages.event-survey-page.8115561e97") : error.message;
        }
    }
    return error instanceof TypeError ? uiText("pages.event-survey-page.883d591e09") : uiText("pages.event-survey-page.69f3e4a855");
}
export function EventSurveyPage() {
    const [locale] = useLocale();
    const { surveyId } = useParams<{
        surveyId: string;
    }>();
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
        setSurvey(undefined);
        setAnswers({});
        setPhone('');
        setError('');
        setSuccess('');
        setSubmitting(false);
        setExistingResponseState(null);
        submitLock.current = false;
        setSession('loading');
        if (!surveyId) {
            setError(uiText("pages.event-survey-page.96d5ce0bb7"));
            return () => controller.abort();
        }
        void surveyApi.get(surveyId, undefined, controller.signal).then((value) => { if (token === routeToken.current)
            setSurvey(value); }).catch((cause: unknown) => { if (token === routeToken.current && !(cause instanceof DOMException && cause.name === 'AbortError'))
            setError(uiText("pages.event-survey-page.10ad78f226")); });
        void surveyApi.session(controller.signal).then(async (value) => {
            if (token !== routeToken.current)
                return;
            if (!value.authenticated) {
                setSession('guest');
                return;
            }
            const mine = await surveyApi.mine(surveyId, controller.signal);
            if (token !== routeToken.current)
                return;
            if (mine.response) {
                setExistingResponseState(mine.response.state);
                const initialAnswers: Record<string, string | string[]> = {};
                for (const answer of mine.response.answers) {
                    if ('textValue' in answer && answer.textValue !== undefined)
                        initialAnswers[answer.questionId] = answer.textValue;
                    else if ('numberValue' in answer && answer.numberValue !== undefined)
                        initialAnswers[answer.questionId] = String(answer.numberValue);
                    else if ('dateValue' in answer && answer.dateValue !== undefined)
                        initialAnswers[answer.questionId] = answer.dateValue;
                    else if ('choiceOptionIds' in answer && answer.choiceOptionIds !== undefined)
                        initialAnswers[answer.questionId] = answer.choiceOptionIds;
                }
                setAnswers(initialAnswers);
            }
            setSession('authenticated');
        }).catch((cause: unknown) => { if (token === routeToken.current && !(cause instanceof DOMException && cause.name === 'AbortError'))
            setSession('error'); });
        return () => controller.abort();
    }, [surveyId]);
    const set = (id: string, value: string | string[]) => setAnswers((old) => ({ ...old, [id]: value }));
    const guestPhoneRequired = Boolean(survey?.phoneRequired && session === 'guest');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!survey || !surveyId || session === 'loading' || session === 'error' || submitLock.current || success)
            return;
        const unavailable = submissionUnavailableMessage(survey, session, existingResponseState);
        if (unavailable) {
            setError(unavailable);
            return;
        }
        setError('');
        setSuccess('');
        if (!event.currentTarget.checkValidity()) {
            event.currentTarget.reportValidity();
            return;
        }
        const questions = survey.sections.flatMap((section) => section.questions);
        const missing = questions.find((question) => question.required && (!answers[question.id] || (Array.isArray(answers[question.id]) && !answers[question.id].length)));
        if (missing || (guestPhoneRequired && !phone.trim())) {
            setError(missing ? uiText("pages.event-survey-page.9f4e78b803") : uiText("pages.event-survey-page.d7e2e62ff4"));
            return;
        }
        for (const question of questions) {
            const value = answers[question.id];
            if ((question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') && typeof value === 'string' && new TextEncoder().encode(value).byteLength > 8192) {
                setError(uiText("pages.event-survey-page.df4fcc3f88"));
                return;
            }
            if (typeof value === 'string' && question.validationRegex) {
                const regexMatch = matchesRestrictedCharacterPattern(question.validationRegex, value);
                if (regexMatch === null) {
                    setError(uiText("pages.event-survey-page.d9d8a6a0f8"));
                    return;
                }
                if (!regexMatch) {
                    setError(uiText("pages.event-survey-page.61e860c3bd"));
                    return;
                }
            }
        }
        const payload = questions.reduce<SurveyResponseAnswerDto[]>((result, question) => {
            const value = answers[question.id];
            if (value === undefined || value === '')
                return result;
            if (question.type === 'NUMBER')
                result.push({ questionId: question.id, numberValue: Number(value) });
            else if (question.type === 'DATE')
                result.push({ questionId: question.id, dateValue: value as string });
            else if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE')
                result.push({ questionId: question.id, choiceOptionIds: Array.isArray(value) ? value : [value] });
            else
                result.push({ questionId: question.id, textValue: value as string });
            return result;
        }, []);
        const token = routeToken.current;
        submitLock.current = true;
        setSubmitting(true);
        try {
            const result = await surveyApi.submit(surveyId, { answers: payload, ...(guestPhoneRequired ? { guestPhone: phone.trim() } : {}) });
            if (session === 'guest' ? !('status' in result) || result.status !== 'ACCEPTED' : !('response' in result))
                throw new Error('Unexpected submission response.');
            if (token === routeToken.current) {
                setExistingResponseState(session === 'authenticated' ? 'SUBMITTED' : null);
                setSuccess(uiText("pages.event-survey-page.c36c2ecaa2"));
            }
        }
        catch (cause) {
            if (token === routeToken.current) {
                submitLock.current = false;
                setError(errorMessage(cause, session === 'guest'));
            }
        }
        finally {
            if (token === routeToken.current)
                setSubmitting(false);
        }
    };
    if (error && !survey)
        return <SiteLayout><p role="alert" className="p-8">{error}</p></SiteLayout>;
    if (!survey)
        return <SiteLayout><p role="status" className="p-8">{uiText("pages.event-survey-page.1a117ba3e7")}</p></SiteLayout>;
    const unavailableMessage = success ? '' : submissionUnavailableMessage(survey, session, existingResponseState);
    const available = !unavailableMessage && !success;
    return <SiteLayout><div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8"><div className="mx-auto w-full px-[12vw]"><h1 className="text-[32px] font-extrabold text-white">{uiText("pages.event-survey-page.e91f6f515d")}</h1></div></div>
    <main className="mx-auto w-full px-[12vw] py-8"><h2 className="text-[28px] font-extrabold">{text(survey.title)}</h2><p className="mt-2">{survey.description ? text(survey.description) : ''}</p>
      {surveyId && <RelatedContentCards subject={{ surveyId }} locale={locale}/>}
      {unavailableMessage && <p role={session === 'error' ? 'alert' : 'status'} className="mt-4 rounded bg-yellow-50 p-4">{unavailableMessage}</p>}
      <form onSubmit={submit}>{survey.sections.map((section) => <fieldset key={section.id} className="mt-6 rounded-[15px] bg-white p-7 shadow"><legend className="text-xl font-bold">{text(section.title)}</legend>{section.questions.map((question) => { const label = text(question.prompt); const value = answers[question.id]; const helpId = `survey-question-help-${question.id}`; const describedBy = question.helpText ? helpId : undefined; const input = question.type === 'LONG_TEXT' ? <textarea aria-label={label} aria-describedby={describedBy} disabled={!available} required={question.required} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 w-full border p-2"/> : question.type === 'SHORT_TEXT' ? <input aria-label={label} aria-describedby={describedBy} disabled={!available} required={question.required} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 w-full border p-2"/> : question.type === 'NUMBER' ? <input aria-label={label} aria-describedby={describedBy} type="number" disabled={!available} required={question.required} min={question.numberMin ?? undefined} max={question.numberMax ?? undefined} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 border p-2"/> : question.type === 'DATE' ? <input aria-label={label} aria-describedby={describedBy} type="date" disabled={!available} required={question.required} min={question.dateMin ?? undefined} max={question.dateMax ?? undefined} value={(value as string) ?? ''} onChange={(e) => set(question.id, e.target.value)} className="mt-2 border p-2"/> : <fieldset aria-describedby={describedBy} className="mt-2 space-y-2"><legend className="font-semibold">{label}{question.required && ' *'}</legend>{question.choices.map((choice) => { const selected = (value as string[] | undefined) ?? []; return <label key={choice.id} className="block"><input disabled={!available} type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={question.id} required={question.required && question.type === 'SINGLE_CHOICE'} checked={question.type === 'SINGLE_CHOICE' ? value === choice.id : selected.includes(choice.id)} onChange={() => question.type === 'SINGLE_CHOICE' ? set(question.id, choice.id) : set(question.id, selected.includes(choice.id) ? selected.filter((id) => id !== choice.id) : [...selected, choice.id])}/> {text(choice.value)}</label>; })}</fieldset>; return <div key={question.id} className="mt-6">{!choiceTypes(question.type) && <label className="block font-semibold">{label} {question.required && <span className="text-red-600">*</span>}</label>}{question.helpText && <p id={helpId} className="text-sm text-kaist-grey">{text(question.helpText)}</p>}{input}</div>; })}</fieldset>)}
        {guestPhoneRequired && <label className="mt-6 block">{uiText("pages.event-survey-page.9a1c3aaaca")}<input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!available} className="ml-3 border p-2"/></label>}
        {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}{success && <p role="status" className="mt-4 text-green-700">{success}</p>}<div className="mt-8 flex justify-between"><Link to="/events">{uiText("pages.event-survey-page.6bb81d1aad")}</Link>{(available || success) && <button type="submit" disabled={submitting || Boolean(success)} className="rounded bg-kaist-darkgreen-main px-6 py-3 text-white">{success ? uiText("pages.event-survey-page.2349d1875e") : submitting ? uiText("pages.event-survey-page.d6f9987955") : uiText("pages.event-survey-page.54be522c71")}</button>}</div>
      </form></main></SiteLayout>;
}
