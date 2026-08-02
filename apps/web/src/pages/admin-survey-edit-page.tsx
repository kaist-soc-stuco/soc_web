import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SurveyDto, SurveyQuestionDefinitionInput, SurveyQuestionType } from '@soc/contracts';
import { parseRestrictedCharacterPattern, SurveyApiError, surveyApi } from '@/lib/survey-api';
const types: SurveyQuestionType[] = ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE'];
const choiceTypes = new Set<SurveyQuestionType>(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);
const bilingual = (kr = '', en = '') => ({ kr, en });
const valueOf = (value: {
    value: string | null;
} | null | undefined) => value?.value ?? '';
const messageFor = (error: unknown) => error instanceof SurveyApiError && error.code === 'survey_not_draft' ? uiText("pages.admin-survey-edit-page.cc16275745") : error instanceof SurveyApiError && error.code === 'invalid_survey_definition' ? uiText("pages.admin-survey-edit-page.d3f992ea29") : error instanceof SurveyApiError && error.status === 401 ? uiText("pages.admin-survey-edit-page.5271ee34a5") : error instanceof TypeError ? uiText("pages.admin-survey-edit-page.883d591e09") : uiText("pages.admin-survey-edit-page.8a91f40cee");
type Question = SurveyDto['sections'][number]['questions'][number];
function definition(question: Question, en: Question | undefined, ordinal: number): SurveyQuestionDefinitionInput {
    const base = {
        ordinal,
        prompt: bilingual(valueOf(question.prompt), valueOf(en?.prompt)),
        helpText: question.helpText || en?.helpText ? bilingual(valueOf(question.helpText), valueOf(en?.helpText)) : null,
        required: question.required,
    };
    if (question.type === 'SHORT_TEXT')
        return { ...base, type: 'SHORT_TEXT', validationRegex: question.validationRegex };
    if (question.type === 'LONG_TEXT')
        return { ...base, type: 'LONG_TEXT', validationRegex: question.validationRegex };
    if (question.type === 'NUMBER')
        return { ...base, type: 'NUMBER', numberMin: question.numberMin, numberMax: question.numberMax };
    if (question.type === 'DATE')
        return { ...base, type: 'DATE', dateMin: question.dateMin, dateMax: question.dateMax };
    const choices = question.choices.map((choice, index) => ({
        ordinal: index,
        value: bilingual(valueOf(choice.value), valueOf(en?.choices[index]?.value)),
    }));
    return question.type === 'SINGLE_CHOICE'
        ? { ...base, type: 'SINGLE_CHOICE', choices }
        : { ...base, type: 'MULTIPLE_CHOICE', choices };
}
function questionOf(type: SurveyQuestionType, base: Pick<Question, 'id' | 'ordinal' | 'prompt' | 'helpText' | 'required'>): Question {
    switch (type) {
        case 'SHORT_TEXT':
        case 'LONG_TEXT':
            return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
        case 'SINGLE_CHOICE':
        case 'MULTIPLE_CHOICE':
            return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
        case 'NUMBER':
            return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
        case 'DATE':
            return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
    }
}
function emptyQuestion(type: SurveyQuestionType, en: boolean): Question {
    return questionOf(type, { id: '', ordinal: 0, prompt: { value: en ? 'New question' : uiText("pages.admin-survey-edit-page.25c5192a76"), translationUnavailable: false }, helpText: null, required: false });
}
function withCommonQuestion(question: Question, patch: Partial<Pick<Question, 'prompt' | 'helpText' | 'required'>>): Question {
    const base = { id: question.id, ordinal: question.ordinal, prompt: patch.prompt ?? question.prompt, helpText: patch.helpText ?? question.helpText, required: patch.required ?? question.required };
    switch (question.type) {
        case 'SHORT_TEXT':
        case 'LONG_TEXT':
            return { ...base, type: question.type, validationRegex: question.validationRegex, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
        case 'SINGLE_CHOICE':
        case 'MULTIPLE_CHOICE':
            return { ...base, type: question.type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: question.choices };
        case 'NUMBER':
            return { ...base, type: 'NUMBER', validationRegex: null, numberMin: question.numberMin, numberMax: question.numberMax, dateMin: null, dateMax: null, choices: [] };
        case 'DATE':
            return { ...base, type: 'DATE', validationRegex: null, numberMin: null, numberMax: null, dateMin: question.dateMin, dateMax: question.dateMax, choices: [] };
    }
}
function withValidation(question: Question, validationRegex: string | null): Question {
    if (question.type !== 'SHORT_TEXT' && question.type !== 'LONG_TEXT')
        return question;
    return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: question.type, required: question.required, validationRegex, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
}
function withNumberBounds(question: Question, patch: Pick<Question & {
    type: 'NUMBER';
}, 'numberMin' | 'numberMax'>): Question {
    if (question.type !== 'NUMBER')
        return question;
    return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: 'NUMBER', required: question.required, validationRegex: null, numberMin: patch.numberMin, numberMax: patch.numberMax, dateMin: null, dateMax: null, choices: [] };
}
function withDateBounds(question: Question, patch: Pick<Question & {
    type: 'DATE';
}, 'dateMin' | 'dateMax'>): Question {
    if (question.type !== 'DATE')
        return question;
    return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: 'DATE', required: question.required, validationRegex: null, numberMin: null, numberMax: null, dateMin: patch.dateMin, dateMax: patch.dateMax, choices: [] };
}
function withChoices(question: Question, choices: Question['choices']): Question {
    if (question.type !== 'SINGLE_CHOICE' && question.type !== 'MULTIPLE_CHOICE')
        return question;
    return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: question.type, required: question.required, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices };
}
const validPattern = (value: string | null): boolean => value === null || parseRestrictedCharacterPattern(value) !== null;
const strictLocalInstant = (value: string): boolean => value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
function validDefinition(question: Question, en: Question | undefined): boolean {
    const koreanHelp = valueOf(question.helpText).trim();
    const englishHelp = valueOf(en?.helpText).trim();
    if (!valueOf(question.prompt).trim() || !valueOf(en?.prompt).trim() || !validPattern(question.validationRegex) || Boolean(koreanHelp) !== Boolean(englishHelp))
        return false;
    if (question.type === 'NUMBER' && ((question.numberMin !== null && (!Number.isFinite(question.numberMin) || !Number.isInteger(question.numberMin))) || (question.numberMax !== null && (!Number.isFinite(question.numberMax) || !Number.isInteger(question.numberMax))) || (question.numberMin !== null && question.numberMax !== null && question.numberMin > question.numberMax)))
        return false;
    if (question.type === 'DATE' && question.dateMin && question.dateMax && question.dateMin > question.dateMax)
        return false;
    return !choiceTypes.has(question.type) || question.choices.length > 0 && question.choices.length === (en?.choices.length ?? 0) && question.choices.every((choice, i) => valueOf(choice.value).trim() && valueOf(en?.choices[i]?.value).trim());
}
function QuestionEditor({ question, english, editable, update, remove, move, questionIndex, questionCount }: {
    question: Question;
    english?: Question;
    editable: boolean;
    update: (locale: 'ko' | 'en', value: Question) => void;
    remove: () => void;
    move: (offset: number) => void;
    questionIndex: number;
    questionCount: number;
}) {
    const source = (locale: 'ko' | 'en') => locale === 'ko' ? question : english ?? question;
    const common = (locale: 'ko' | 'en', patch: Partial<Pick<Question, 'prompt' | 'helpText' | 'required'>>) => update(locale, withCommonQuestion(source(locale), patch));
    const position = questionIndex + 1;
    return <div className="mt-3 border p-3"><select aria-label={uiFormat("pages.admin-survey-edit-page.template.22dc100a78", [position])} value={question.type} disabled={!editable} onChange={(e) => { const type = e.target.value as SurveyQuestionType; update('ko', questionOf(type, question)); update('en', questionOf(type, english ?? question)); }}>{types.map((type) => <option key={type}>{type}</option>)}</select><button type="button" aria-label={uiFormat("pages.admin-survey-edit-page.template.3fc5ebb84a", [position])} onClick={() => move(-1)} disabled={!editable || questionIndex === 0}>↑</button><button type="button" aria-label={uiFormat("pages.admin-survey-edit-page.template.1ab92ffe49", [position])} onClick={() => move(1)} disabled={!editable || questionIndex === questionCount - 1}>↓</button><button type="button" aria-label={uiFormat("pages.admin-survey-edit-page.template.aa9447c7b4", [position])} onClick={remove} disabled={!editable}>{uiText("pages.admin-survey-edit-page.850b6d316e")}</button>
    <label><input type="checkbox" checked={question.required} disabled={!editable} onChange={(e) => common('ko', { required: e.target.checked })}/>{uiText("pages.admin-survey-edit-page.5b4a45c263")}</label><label>{uiText("pages.admin-survey-edit-page.08b859d229")}<input value={valueOf(question.prompt)} disabled={!editable} onChange={(e) => common('ko', { prompt: { ...question.prompt, value: e.target.value } })}/></label><label>Question (English)<input value={valueOf(english?.prompt)} disabled={!editable} onChange={(e) => common('en', { prompt: { ...(english?.prompt ?? question.prompt), value: e.target.value } })}/></label>
    <label>{uiText("pages.admin-survey-edit-page.f55a3f8a04")}<input value={valueOf(question.helpText)} disabled={!editable} onChange={(e) => common('ko', { helpText: { ...(question.helpText ?? question.prompt), value: e.target.value } })}/></label><label>Help text (English)<input value={valueOf(english?.helpText)} disabled={!editable} onChange={(e) => common('en', { helpText: { ...(english?.helpText ?? question.prompt), value: e.target.value } })}/></label>
    {(question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') && <label>{uiText("pages.admin-survey-edit-page.fc7e4f6228")}<input value={question.validationRegex ?? ''} disabled={!editable} onChange={(e) => update('ko', withValidation(question, e.target.value || null))}/></label>}{question.type === 'NUMBER' && <><label>{uiText("pages.admin-survey-edit-page.e4f481a862")}<input type="number" value={question.numberMin ?? ''} disabled={!editable} onChange={(e) => update('ko', withNumberBounds(question, { numberMin: e.target.value === '' ? null : Number(e.target.value), numberMax: question.numberMax }))}/></label><label>{uiText("pages.admin-survey-edit-page.eeb8d1ae13")}<input type="number" value={question.numberMax ?? ''} disabled={!editable} onChange={(e) => update('ko', withNumberBounds(question, { numberMin: question.numberMin, numberMax: e.target.value === '' ? null : Number(e.target.value) }))}/></label></>}{question.type === 'DATE' && <><label>{uiText("pages.admin-survey-edit-page.453c56f595")}<input type="date" value={question.dateMin ?? ''} disabled={!editable} onChange={(e) => update('ko', withDateBounds(question, { dateMin: e.target.value || null, dateMax: question.dateMax }))}/></label><label>{uiText("pages.admin-survey-edit-page.cad7c84c3e")}<input type="date" value={question.dateMax ?? ''} disabled={!editable} onChange={(e) => update('ko', withDateBounds(question, { dateMin: question.dateMin, dateMax: e.target.value || null }))}/></label></>}{choiceTypes.has(question.type) && <><label>{uiText("pages.admin-survey-edit-page.7547f8a5e4")}<input value={question.choices.map((c) => valueOf(c.value)).join(',')} disabled={!editable} onChange={(e) => update('ko', withChoices(question, e.target.value.split(',').map((v) => v.trim()).filter(Boolean).map((value, ordinal) => ({ id: question.choices[ordinal]?.id ?? '', ordinal, value: { value, translationUnavailable: false } }))))}/></label><label>Choices (English, comma separated)<input value={(english?.choices ?? []).map((c) => valueOf(c.value)).join(',')} disabled={!editable} onChange={(e) => update('en', withChoices(source('en'), e.target.value.split(',').map((v) => v.trim()).filter(Boolean).map((value, ordinal) => ({ id: english?.choices[ordinal]?.id ?? '', ordinal, value: { value, translationUnavailable: false } }))))}/></label></>}</div>;
}
export function AdminSurveyEditPage() {
    const { surveyId } = useParams<{
        surveyId: string;
    }>();
    const navigate = useNavigate();
    const [survey, setSurvey] = useState<SurveyDto>();
    const [english, setEnglish] = useState<SurveyDto>();
    const [tab, setTab] = useState<'settings' | 'questions'>('settings');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [descriptionKo, setDescriptionKo] = useState('');
    const [descriptionEn, setDescriptionEn] = useState('');
    const [cap, setCap] = useState('');
    const [feeRestriction, setFeeRestriction] = useState<'ANY' | 'PAID_ONLY'>('ANY');
    const [guestAllowed, setGuestAllowed] = useState(false);
    const [phoneRequired, setPhoneRequired] = useState(false);
    const [opensAt, setOpensAt] = useState('');
    const [closesAt, setClosesAt] = useState('');
    const [editDeadlineAt, setEditDeadlineAt] = useState('');
    const [retentionDays, setRetentionDays] = useState('365');
    const isNew = surveyId === 'new';
    const mutationLock = useRef(false);
    const sourceToken = useRef(0);
    const [mutating, setMutating] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false);
    const [definitionsDirty, setDefinitionsDirty] = useState(false);
    const dirty = settingsDirty || definitionsDirty;
    const setDirty = setSettingsDirty;
    const editable = (isNew || survey?.state === 'DRAFT') && !mutating;
    const load = async (id: string, signal?: AbortSignal, token = sourceToken.current, preserveSettings = false) => {
        setStatus('loading');
        setError('');
        try {
            const [ko, en] = await Promise.all([surveyApi.get(id, 'ko', signal), surveyApi.get(id, 'en', signal)]);
            if (token !== sourceToken.current || id !== surveyId)
                return;
            setSurvey(ko);
            setEnglish(en);
            if (!preserveSettings) {
                setTitleKo(valueOf(ko.title));
                setTitleEn(valueOf(en.title));
                setDescriptionKo(valueOf(ko.description));
                setDescriptionEn(valueOf(en.description));
                setCap(ko.cap?.toString() ?? '');
                setFeeRestriction(ko.feeRestriction);
                setGuestAllowed(ko.guestAllowed);
                setPhoneRequired(ko.phoneRequired);
                setOpensAt(ko.opensAt?.slice(0, 16) ?? '');
                setClosesAt(ko.closesAt?.slice(0, 16) ?? '');
                setEditDeadlineAt(ko.editDeadlineAt?.slice(0, 16) ?? '');
                setRetentionDays(String(ko.responseRetentionDays));
                setSettingsDirty(false);
            }
            setDefinitionsDirty(false);
            setStatus('ready');
        }
        catch (cause) {
            if (token === sourceToken.current && !(cause instanceof DOMException && cause.name === 'AbortError')) {
                setStatus('error');
                setError(uiText("pages.admin-survey-edit-page.10ad78f226"));
            }
        }
    };
    useEffect(() => {
        const controller = new AbortController();
        const token = ++sourceToken.current;
        mutationLock.current = false;
        setSurvey(undefined);
        setEnglish(undefined);
        setTab('settings');
        setError('');
        setMessage('');
        setTitleKo('');
        setTitleEn('');
        setDescriptionKo('');
        setDescriptionEn('');
        setCap('');
        setFeeRestriction('ANY');
        setGuestAllowed(false);
        setPhoneRequired(false);
        setOpensAt('');
        setClosesAt('');
        setEditDeadlineAt('');
        setRetentionDays('365');
        setSettingsDirty(false);
        setDefinitionsDirty(false);
        if (!isNew && surveyId)
            void load(surveyId, controller.signal, token);
        else
            setStatus('ready');
        return () => controller.abort();
    }, [surveyId, isNew]);
    const settingsValid = Boolean(closesAt) && strictLocalInstant(opensAt) && strictLocalInstant(closesAt) && strictLocalInstant(editDeadlineAt) && (!opensAt || new Date(opensAt).getTime() < new Date(closesAt).getTime()) && (!editDeadlineAt || new Date(editDeadlineAt).getTime() <= new Date(closesAt).getTime()) && (!phoneRequired || guestAllowed) && !(feeRestriction === 'PAID_ONLY' && guestAllowed) && (cap === '' || Number.isInteger(Number(cap)) && Number(cap) > 0) && Number.isInteger(Number(retentionDays)) && Number(retentionDays) >= 1 && Number(retentionDays) <= 3650 && Boolean(descriptionKo.trim()) === Boolean(descriptionEn.trim());
    const beginMutation = () => {
        if (mutationLock.current)
            return false;
        mutationLock.current = true;
        setMutating(true);
        return true;
    };
    const finishMutation = (token: number) => {
        if (token === sourceToken.current) {
            mutationLock.current = false;
            setMutating(false);
        }
    };
    const saveSettings = async () => {
        if (!editable || !settingsValid || !titleKo.trim() || !titleEn.trim() || !beginMutation()) {
            if (!titleKo.trim() || !titleEn.trim())
                setError(uiText("pages.admin-survey-edit-page.fca7e82e49"));
            else if (!settingsValid)
                setError(uiText("pages.admin-survey-edit-page.f249c005c0"));
            return;
        }
        const token = sourceToken.current;
        setError('');
        setMessage('');
        try {
            const input = { title: bilingual(titleKo, titleEn), description: descriptionKo.trim() || descriptionEn.trim() ? bilingual(descriptionKo, descriptionEn) : null, guestAllowed, phoneRequired, feeRestriction, cap: cap ? Number(cap) : null, opensAt: opensAt ? new Date(opensAt).toISOString() : null, closesAt: new Date(closesAt).toISOString(), editDeadlineAt: editDeadlineAt ? new Date(editDeadlineAt).toISOString() : null, responseRetentionDays: Number(retentionDays) };
            const saved = survey ? await surveyApi.patch(survey.id, input) : await surveyApi.create(input);
            if (token !== sourceToken.current)
                return;
            setMessage(uiText("pages.admin-survey-edit-page.62088d6534"));
            setSettingsDirty(false);
            if (isNew)
                navigate(`/admin/surveys/${saved.id}/edit`, { replace: true });
            else {
                setSurvey((current) => current ? { ...saved, sections: current.sections } : saved);
                setEnglish((current) => current ? { ...saved, sections: current.sections } : saved);
            }
        }
        catch (cause) {
            if (token === sourceToken.current)
                setError(messageFor(cause));
        }
        finally {
            finishMutation(token);
        }
    };
    const mutate = (setter: typeof setSurvey, fn: (s: SurveyDto) => SurveyDto) => { setDefinitionsDirty(true); setter((current) => current ? fn(current) : current); };
    const updateQuestion = (sectionIndex: number, questionIndex: number, locale: 'ko' | 'en', value: Question) => mutate(locale === 'ko' ? setSurvey : setEnglish, (s) => ({ ...s, sections: s.sections.map((section, i) => i === sectionIndex ? { ...section, questions: section.questions.map((q, j) => j === questionIndex ? value : q) } : section) }));
    const reorder = <T,>(items: T[], index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= items.length)
            return items;
        const copy = [...items];
        [copy[index], copy[target]] = [copy[target], copy[index]];
        return copy.map((item, ordinal) => ({ ...item, ordinal }));
    };
    const saveQuestions = async () => {
        if (!survey || !editable || !survey.sections.every((section, i) => valueOf(section.title).trim() && valueOf(english?.sections[i]?.title).trim() && section.questions.every((q, j) => validDefinition(q, english?.sections[i]?.questions[j]))) || !beginMutation()) {
            setError(uiText("pages.admin-survey-edit-page.1fbdd7106b"));
            return;
        }
        const token = sourceToken.current;
        let serverMutated = false;
        setError('');
        setMessage('');
        try {
            const savedSections = await surveyApi.replaceSections(survey.id, {
                sections: survey.sections.map((section, ordinal) => ({
                    ordinal,
                    title: bilingual(valueOf(section.title), valueOf(english?.sections[ordinal]?.title)),
                })),
            });
            serverMutated = true;
            for (let i = 0; i < savedSections.sections.length; i++) {
                if (token !== sourceToken.current)
                    return;
                await surveyApi.replaceQuestions(savedSections.sections[i].id, {
                    questions: survey.sections[i].questions.map((q, ordinal) => definition(q, english?.sections[i]?.questions[ordinal], ordinal)),
                });
            }
            if (token === sourceToken.current) {
                await load(survey.id, undefined, token, settingsDirty);
                setMessage(uiText("pages.admin-survey-edit-page.780b54c63a"));
            }
        }
        catch (cause) {
            if (token === sourceToken.current) {
                setError(serverMutated ? uiFormat("pages.admin-survey-edit-page.template.9bdb154f21", [messageFor(cause)]) : messageFor(cause));
            }
        }
        finally {
            finishMutation(token);
        }
    };
    const addSection = () => {
        for (const [setter, en] of [[setSurvey, false], [setEnglish, true]] as const)
            mutate(setter, (s) => ({ ...s, sections: [...s.sections, { id: '', ordinal: s.sections.length, title: { value: en ? 'New section' : uiText("pages.admin-survey-edit-page.7096cfb48e"), translationUnavailable: false }, questions: [] }] }));
    };
    const publish = async () => {
        if (!survey || !editable || settingsDirty || definitionsDirty || !beginMutation()) {
            if (settingsDirty || definitionsDirty)
                setError(uiText("pages.admin-survey-edit-page.53a69cfafa"));
            return;
        }
        const token = sourceToken.current;
        const id = survey.id;
        setError('');
        setMessage('');
        try {
            await surveyApi.publish(id);
            if (token !== sourceToken.current || id !== surveyId)
                return;
            await load(id, undefined, token);
            if (token === sourceToken.current)
                setMessage(uiText("pages.admin-survey-edit-page.cf5827e69c"));
        }
        catch (cause) {
            if (token === sourceToken.current)
                setError(messageFor(cause));
        }
        finally {
            finishMutation(token);
        }
    };
    return <section className="min-h-screen bg-[#F7FCFC]"><header className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-[12vw] py-8 text-white"><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-survey-edit-page.bfa15aa4f4")}</h1></header><nav className="flex gap-4 border-b p-4"><button onClick={() => setTab('settings')}>{uiText("pages.admin-survey-edit-page.c14a567ea9")}</button><button onClick={() => setTab('questions')} disabled={!survey}>{uiText("pages.admin-survey-edit-page.2ab096e7f4")}</button><Link to="/admin/surveys">{uiText("pages.admin-survey-edit-page.b6071ac7eb")}</Link>{survey && <><button onClick={saveQuestions} disabled={!editable}>{uiText("pages.admin-survey-edit-page.abf36de8c0")}</button><button onClick={publish} disabled={!editable || dirty}>{uiText("pages.admin-survey-edit-page.6627c55ead")}</button></>}</nav><main className="p-8">{error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}{status === 'loading' ? <p role="status">{uiText("pages.admin-survey-edit-page.1a117ba3e7")}</p> : tab === 'settings' ? <div className="grid max-w-2xl gap-4"><label>{uiText("pages.admin-survey-edit-page.b8fb134296")}<input value={titleKo} onChange={(e) => { setDirty(true); setTitleKo(e.target.value); }} disabled={!editable}/></label><label>Title (English)<input value={titleEn} onChange={(e) => { setDirty(true); setTitleEn(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.d334abdd70")}<textarea value={descriptionKo} onChange={(e) => { setDirty(true); setDescriptionKo(e.target.value); }} disabled={!editable}/></label><label>Description (English)<textarea value={descriptionEn} onChange={(e) => { setDirty(true); setDescriptionEn(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.6b35572d8d")}<input type="number" min="1" value={cap} onChange={(e) => { setDirty(true); setCap(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.c1ebfbc299")}<select value={feeRestriction} disabled={!editable} onChange={(e) => { setDirty(true); setFeeRestriction(e.target.value as 'ANY' | 'PAID_ONLY'); }}><option value="ANY">{uiText("pages.admin-survey-edit-page.4efeea4126")}</option><option value="PAID_ONLY">{uiText("pages.admin-survey-edit-page.d8e4e6101c")}</option></select></label><label>{uiText("pages.admin-survey-edit-page.170813bd08")}<input type="datetime-local" value={opensAt} onChange={(e) => { setDirty(true); setOpensAt(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.cd1bf7892a")}<input type="datetime-local" value={closesAt} onChange={(e) => { setDirty(true); setClosesAt(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.b4b253441d")}<input type="datetime-local" value={editDeadlineAt} onChange={(e) => { setDirty(true); setEditDeadlineAt(e.target.value); }} disabled={!editable}/></label><label>{uiText("pages.admin-survey-edit-page.fca31c0f94")}<input type="number" min="1" value={retentionDays} onChange={(e) => { setDirty(true); setRetentionDays(e.target.value); }} disabled={!editable}/></label><label><input type="checkbox" checked={guestAllowed} onChange={(e) => {
                setDirty(true);
                setGuestAllowed(e.target.checked);
                if (!e.target.checked)
                    setPhoneRequired(false);
            }} disabled={!editable}/>{uiText("pages.admin-survey-edit-page.88234ffdf5")}</label><label><input type="checkbox" checked={phoneRequired} onChange={(e) => { setDirty(true); setPhoneRequired(e.target.checked); }} disabled={!editable || !guestAllowed}/>{uiText("pages.admin-survey-edit-page.8bba2beb68")}</label><button onClick={saveSettings} disabled={!editable || !settingsValid}>{uiText("pages.admin-survey-edit-page.b25827149b")}</button></div> : <div>{survey?.sections.map((section, sectionIndex) => <section key={section.id || sectionIndex} className="mb-6 bg-white p-5"><label>{uiText("pages.admin-survey-edit-page.6869b294e4")}<input value={valueOf(section.title)} disabled={!editable} onChange={(e) => mutate(setSurvey, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, title: { ...item.title, value: e.target.value } } : item) }))}/></label><label>Section (English)<input value={valueOf(english?.sections[sectionIndex]?.title)} disabled={!editable} onChange={(e) => mutate(setEnglish, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, title: { ...item.title, value: e.target.value } } : item) }))}/></label><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, -1) })); mutate(setEnglish, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, -1) })); }} disabled={!editable || sectionIndex === 0} aria-label={uiFormat("pages.admin-survey-edit-page.template.ce53b2f526", [sectionIndex + 1])}>↑</button><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, 1) })); mutate(setEnglish, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, 1) })); }} disabled={!editable || sectionIndex === survey.sections.length - 1} aria-label={uiFormat("pages.admin-survey-edit-page.template.538a3ebc12", [sectionIndex + 1])}>↓</button><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: s.sections.filter((_, i) => i !== sectionIndex) })); mutate(setEnglish, (s) => ({ ...s, sections: s.sections.filter((_, i) => i !== sectionIndex) })); }} disabled={!editable} aria-label={uiFormat("pages.admin-survey-edit-page.template.ee115f0982", [sectionIndex + 1])}>{uiText("pages.admin-survey-edit-page.6e7c86be9a")}</button>{section.questions.map((question, questionIndex) => <QuestionEditor key={question.id || questionIndex} question={question} english={english?.sections[sectionIndex]?.questions[questionIndex]} editable={editable} questionIndex={questionIndex} questionCount={section.questions.length} update={(locale, value) => updateQuestion(sectionIndex, questionIndex, locale, value)} remove={() => {
                        for (const setter of [setSurvey, setEnglish])
                            mutate(setter, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: item.questions.filter((_, j) => j !== questionIndex) } : item) }));
                    }} move={(offset) => {
                        for (const setter of [setSurvey, setEnglish])
                            mutate(setter, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: reorder(item.questions, questionIndex, offset) } : item) }));
                    }}/>)}{types.map((type) => <button key={type} type="button" aria-label={uiFormat("pages.admin-survey-edit-page.template.668763925e", [sectionIndex + 1, type])} onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: [...item.questions, emptyQuestion(type, false)] } : item) })); mutate(setEnglish, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: [...item.questions, emptyQuestion(type, true)] } : item) })); }} disabled={!editable}>+ {type}</button>)}</section>)}<button type="button" onClick={addSection} disabled={!editable}>{uiText("pages.admin-survey-edit-page.f7899ca881")}</button></div>}</main></section>;
}
