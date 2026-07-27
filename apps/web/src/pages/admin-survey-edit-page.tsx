import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SurveyDto, SurveyQuestionDefinitionInput, SurveyQuestionType } from '@soc/contracts';
import { parseRestrictedCharacterPattern, SurveyApiError, surveyApi } from '@/lib/survey-api';

const types: SurveyQuestionType[] = ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE'];
const choiceTypes = new Set<SurveyQuestionType>(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);
const bilingual = (kr = '', en = '') => ({ kr, en });
const valueOf = (value: { value: string | null } | null | undefined) => value?.value ?? '';
const messageFor = (error: unknown) => error instanceof SurveyApiError && error.code === 'survey_not_draft' ? '게시된 설문은 수정할 수 없습니다.' : error instanceof SurveyApiError && error.code === 'invalid_survey_definition' ? '설정 저장에 실패했습니다.' : error instanceof SurveyApiError && error.status === 401 ? '로그인이 필요합니다.' : error instanceof TypeError ? '네트워크 연결을 확인해 주세요.' : '저장에 실패했습니다.';
type Question = SurveyDto['sections'][number]['questions'][number];

function definition(question: Question, en: Question | undefined, ordinal: number): SurveyQuestionDefinitionInput {
  const base = {
    ordinal,
    prompt: bilingual(valueOf(question.prompt), valueOf(en?.prompt)),
    helpText: question.helpText || en?.helpText ? bilingual(valueOf(question.helpText), valueOf(en?.helpText)) : null,
    required: question.required,
  };
  if (question.type === 'SHORT_TEXT') return { ...base, type: 'SHORT_TEXT', validationRegex: question.validationRegex };
  if (question.type === 'LONG_TEXT') return { ...base, type: 'LONG_TEXT', validationRegex: question.validationRegex };
  if (question.type === 'NUMBER') return { ...base, type: 'NUMBER', numberMin: question.numberMin, numberMax: question.numberMax };
  if (question.type === 'DATE') return { ...base, type: 'DATE', dateMin: question.dateMin, dateMax: question.dateMax };
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
  return questionOf(type, { id: '', ordinal: 0, prompt: { value: en ? 'New question' : '새 질문', translationUnavailable: false }, helpText: null, required: false });
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
  if (question.type !== 'SHORT_TEXT' && question.type !== 'LONG_TEXT') return question;
  return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: question.type, required: question.required, validationRegex, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
}
function withNumberBounds(question: Question, patch: Pick<Question & { type: 'NUMBER' }, 'numberMin' | 'numberMax'>): Question {
  if (question.type !== 'NUMBER') return question;
  return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: 'NUMBER', required: question.required, validationRegex: null, numberMin: patch.numberMin, numberMax: patch.numberMax, dateMin: null, dateMax: null, choices: [] };
}
function withDateBounds(question: Question, patch: Pick<Question & { type: 'DATE' }, 'dateMin' | 'dateMax'>): Question {
  if (question.type !== 'DATE') return question;
  return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: 'DATE', required: question.required, validationRegex: null, numberMin: null, numberMax: null, dateMin: patch.dateMin, dateMax: patch.dateMax, choices: [] };
}
function withChoices(question: Question, choices: Question['choices']): Question {
  if (question.type !== 'SINGLE_CHOICE' && question.type !== 'MULTIPLE_CHOICE') return question;
  return { id: question.id, ordinal: question.ordinal, prompt: question.prompt, helpText: question.helpText, type: question.type, required: question.required, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices };
}
const validPattern = (value: string | null): boolean => value === null || parseRestrictedCharacterPattern(value) !== null;
const strictLocalInstant = (value: string): boolean => value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
function validDefinition(question: Question, en: Question | undefined): boolean {
  const koreanHelp = valueOf(question.helpText).trim();
  const englishHelp = valueOf(en?.helpText).trim();
  if (!valueOf(question.prompt).trim() || !valueOf(en?.prompt).trim() || !validPattern(question.validationRegex) || Boolean(koreanHelp) !== Boolean(englishHelp)) return false;
  if (question.type === 'NUMBER' && ((question.numberMin !== null && (!Number.isFinite(question.numberMin) || !Number.isInteger(question.numberMin))) || (question.numberMax !== null && (!Number.isFinite(question.numberMax) || !Number.isInteger(question.numberMax))) || (question.numberMin !== null && question.numberMax !== null && question.numberMin > question.numberMax))) return false;
  if (question.type === 'DATE' && question.dateMin && question.dateMax && question.dateMin > question.dateMax) return false;
  return !choiceTypes.has(question.type) || question.choices.length > 0 && question.choices.length === (en?.choices.length ?? 0) && question.choices.every((choice, i) => valueOf(choice.value).trim() && valueOf(en?.choices[i]?.value).trim());
}

function QuestionEditor({ question, english, editable, update, remove, move, questionIndex, questionCount }: { question: Question; english?: Question; editable: boolean; update: (locale: 'ko' | 'en', value: Question) => void; remove: () => void; move: (offset: number) => void; questionIndex: number; questionCount: number }) {
  const source = (locale: 'ko' | 'en') => locale === 'ko' ? question : english ?? question;
  const common = (locale: 'ko' | 'en', patch: Partial<Pick<Question, 'prompt' | 'helpText' | 'required'>>) => update(locale, withCommonQuestion(source(locale), patch));
  const position = questionIndex + 1;
  return <div className="mt-3 border p-3"><select aria-label={`질문 ${position} 유형`} value={question.type} disabled={!editable} onChange={(e) => { const type = e.target.value as SurveyQuestionType; update('ko', questionOf(type, question)); update('en', questionOf(type, english ?? question)); }}>{types.map((type) => <option key={type}>{type}</option>)}</select><button type="button" aria-label={`질문 ${position} 위로 이동`} onClick={() => move(-1)} disabled={!editable || questionIndex === 0}>↑</button><button type="button" aria-label={`질문 ${position} 아래로 이동`} onClick={() => move(1)} disabled={!editable || questionIndex === questionCount - 1}>↓</button><button type="button" aria-label={`질문 ${position} 삭제`} onClick={remove} disabled={!editable}>질문 삭제</button>
    <label><input type="checkbox" checked={question.required} disabled={!editable} onChange={(e) => common('ko', { required: e.target.checked })} /> 필수</label><label>질문 (한국어)<input value={valueOf(question.prompt)} disabled={!editable} onChange={(e) => common('ko', { prompt: { ...question.prompt, value: e.target.value } })} /></label><label>Question (English)<input value={valueOf(english?.prompt)} disabled={!editable} onChange={(e) => common('en', { prompt: { ...(english?.prompt ?? question.prompt), value: e.target.value } })} /></label>
    <label>도움말 (한국어)<input value={valueOf(question.helpText)} disabled={!editable} onChange={(e) => common('ko', { helpText: { ...(question.helpText ?? question.prompt), value: e.target.value } })} /></label><label>Help text (English)<input value={valueOf(english?.helpText)} disabled={!editable} onChange={(e) => common('en', { helpText: { ...(english?.helpText ?? question.prompt), value: e.target.value } })} /></label>
    {(question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') && <label>정규식<input value={question.validationRegex ?? ''} disabled={!editable} onChange={(e) => update('ko', withValidation(question, e.target.value || null))} /></label>}{question.type === 'NUMBER' && <><label>최소값<input type="number" value={question.numberMin ?? ''} disabled={!editable} onChange={(e) => update('ko', withNumberBounds(question, { numberMin: e.target.value === '' ? null : Number(e.target.value), numberMax: question.numberMax }))} /></label><label>최대값<input type="number" value={question.numberMax ?? ''} disabled={!editable} onChange={(e) => update('ko', withNumberBounds(question, { numberMin: question.numberMin, numberMax: e.target.value === '' ? null : Number(e.target.value) }))} /></label></>}{question.type === 'DATE' && <><label>시작일<input type="date" value={question.dateMin ?? ''} disabled={!editable} onChange={(e) => update('ko', withDateBounds(question, { dateMin: e.target.value || null, dateMax: question.dateMax }))} /></label><label>종료일<input type="date" value={question.dateMax ?? ''} disabled={!editable} onChange={(e) => update('ko', withDateBounds(question, { dateMin: question.dateMin, dateMax: e.target.value || null }))} /></label></>}{choiceTypes.has(question.type) && <><label>선택지 (한국어, 쉼표 구분)<input value={question.choices.map((c) => valueOf(c.value)).join(',')} disabled={!editable} onChange={(e) => update('ko', withChoices(question, e.target.value.split(',').map((v) => v.trim()).filter(Boolean).map((value, ordinal) => ({ id: question.choices[ordinal]?.id ?? '', ordinal, value: { value, translationUnavailable: false } }))))} /></label><label>Choices (English, comma separated)<input value={(english?.choices ?? []).map((c) => valueOf(c.value)).join(',')} disabled={!editable} onChange={(e) => update('en', withChoices(source('en'), e.target.value.split(',').map((v) => v.trim()).filter(Boolean).map((value, ordinal) => ({ id: english?.choices[ordinal]?.id ?? '', ordinal, value: { value, translationUnavailable: false } }))))} /></label></>}</div>;
}

export function AdminSurveyEditPage() {
  const { surveyId } = useParams<{ surveyId: string }>(); const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyDto>(); const [english, setEnglish] = useState<SurveyDto>(); const [tab, setTab] = useState<'settings' | 'questions'>('settings'); const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [titleKo, setTitleKo] = useState(''); const [titleEn, setTitleEn] = useState(''); const [descriptionKo, setDescriptionKo] = useState(''); const [descriptionEn, setDescriptionEn] = useState(''); const [cap, setCap] = useState(''); const [feeRestriction, setFeeRestriction] = useState<'ANY' | 'PAID_ONLY'>('ANY'); const [guestAllowed, setGuestAllowed] = useState(false); const [phoneRequired, setPhoneRequired] = useState(false); const [opensAt, setOpensAt] = useState(''); const [closesAt, setClosesAt] = useState(''); const [editDeadlineAt, setEditDeadlineAt] = useState(''); const [retentionDays, setRetentionDays] = useState('365');
  const isNew = surveyId === 'new'; const mutationLock = useRef(false); const sourceToken = useRef(0); const [mutating, setMutating] = useState(false); const [settingsDirty, setSettingsDirty] = useState(false); const [definitionsDirty, setDefinitionsDirty] = useState(false); const dirty = settingsDirty || definitionsDirty; const setDirty = setSettingsDirty;
  const editable = (isNew || survey?.state === 'DRAFT') && !mutating;
  const load = async (id: string, signal?: AbortSignal, token = sourceToken.current, preserveSettings = false) => { setStatus('loading'); setError(''); try { const [ko, en] = await Promise.all([surveyApi.get(id, 'ko', signal), surveyApi.get(id, 'en', signal)]); if (token !== sourceToken.current || id !== surveyId) return; setSurvey(ko); setEnglish(en); if (!preserveSettings) { setTitleKo(valueOf(ko.title)); setTitleEn(valueOf(en.title)); setDescriptionKo(valueOf(ko.description)); setDescriptionEn(valueOf(en.description)); setCap(ko.cap?.toString() ?? ''); setFeeRestriction(ko.feeRestriction); setGuestAllowed(ko.guestAllowed); setPhoneRequired(ko.phoneRequired); setOpensAt(ko.opensAt?.slice(0, 16) ?? ''); setClosesAt(ko.closesAt?.slice(0, 16) ?? ''); setEditDeadlineAt(ko.editDeadlineAt?.slice(0, 16) ?? ''); setRetentionDays(String(ko.responseRetentionDays)); setSettingsDirty(false); } setDefinitionsDirty(false); setStatus('ready'); } catch (cause) { if (token === sourceToken.current && !(cause instanceof DOMException && cause.name === 'AbortError')) { setStatus('error'); setError('설문을 불러오지 못했습니다.'); } } };
  useEffect(() => { const controller = new AbortController(); const token = ++sourceToken.current; mutationLock.current = false; setSurvey(undefined); setEnglish(undefined); setTab('settings'); setError(''); setMessage(''); setTitleKo(''); setTitleEn(''); setDescriptionKo(''); setDescriptionEn(''); setCap(''); setFeeRestriction('ANY'); setGuestAllowed(false); setPhoneRequired(false); setOpensAt(''); setClosesAt(''); setEditDeadlineAt(''); setRetentionDays('365'); setSettingsDirty(false); setDefinitionsDirty(false); if (!isNew && surveyId) void load(surveyId, controller.signal, token); else setStatus('ready'); return () => controller.abort(); }, [surveyId, isNew]);
  const settingsValid = Boolean(closesAt) && strictLocalInstant(opensAt) && strictLocalInstant(closesAt) && strictLocalInstant(editDeadlineAt) && (!opensAt || new Date(opensAt).getTime() < new Date(closesAt).getTime()) && (!editDeadlineAt || new Date(editDeadlineAt).getTime() <= new Date(closesAt).getTime()) && (!phoneRequired || guestAllowed) && !(feeRestriction === 'PAID_ONLY' && guestAllowed) && (cap === '' || Number.isInteger(Number(cap)) && Number(cap) > 0) && Number.isInteger(Number(retentionDays)) && Number(retentionDays) >= 1 && Number(retentionDays) <= 3_650 && Boolean(descriptionKo.trim()) === Boolean(descriptionEn.trim());
  const beginMutation = () => { if (mutationLock.current) return false; mutationLock.current = true; setMutating(true); return true; };
  const finishMutation = (token: number) => { if (token === sourceToken.current) { mutationLock.current = false; setMutating(false); } };
  const saveSettings = async () => { if (!editable || !settingsValid || !titleKo.trim() || !titleEn.trim() || !beginMutation()) { if (!titleKo.trim() || !titleEn.trim()) setError('한국어와 영어 제목을 입력해 주세요.'); else if (!settingsValid) setError('설정 값과 한국어/영어 설명을 확인해 주세요.'); return; } const token = sourceToken.current; setError(''); setMessage(''); try { const input = { title: bilingual(titleKo, titleEn), description: descriptionKo.trim() || descriptionEn.trim() ? bilingual(descriptionKo, descriptionEn) : null, guestAllowed, phoneRequired, feeRestriction, cap: cap ? Number(cap) : null, opensAt: opensAt ? new Date(opensAt).toISOString() : null, closesAt: new Date(closesAt).toISOString(), editDeadlineAt: editDeadlineAt ? new Date(editDeadlineAt).toISOString() : null, responseRetentionDays: Number(retentionDays) }; const saved = survey ? await surveyApi.patch(survey.id, input) : await surveyApi.create(input); if (token !== sourceToken.current) return; setMessage('설정이 저장되었습니다.'); setSettingsDirty(false); if (isNew) navigate(`/admin/surveys/${saved.id}/edit`, { replace: true }); else { setSurvey((current) => current ? { ...saved, sections: current.sections } : saved); setEnglish((current) => current ? { ...saved, sections: current.sections } : saved); } } catch (cause) { if (token === sourceToken.current) setError(messageFor(cause)); } finally { finishMutation(token); } };
  const mutate = (setter: typeof setSurvey, fn: (s: SurveyDto) => SurveyDto) => { setDefinitionsDirty(true); setter((current) => current ? fn(current) : current); };
  const updateQuestion = (sectionIndex: number, questionIndex: number, locale: 'ko' | 'en', value: Question) => mutate(locale === 'ko' ? setSurvey : setEnglish, (s) => ({ ...s, sections: s.sections.map((section, i) => i === sectionIndex ? { ...section, questions: section.questions.map((q, j) => j === questionIndex ? value : q) } : section) }));
  const reorder = <T,>(items: T[], index: number, offset: number) => { const target = index + offset; if (target < 0 || target >= items.length) return items; const copy = [...items]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy.map((item, ordinal) => ({ ...item, ordinal })); };
  const saveQuestions = async () => {
    if (!survey || !editable || !survey.sections.every((section, i) => valueOf(section.title).trim() && valueOf(english?.sections[i]?.title).trim() && section.questions.every((q, j) => validDefinition(q, english?.sections[i]?.questions[j]))) || !beginMutation()) {
      setError('모든 섹션, 질문, 선택지의 한국어/영어 내용을 확인해 주세요.');
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
        if (token !== sourceToken.current) return;
        await surveyApi.replaceQuestions(savedSections.sections[i].id, {
          questions: survey.sections[i].questions.map((q, ordinal) => definition(q, english?.sections[i]?.questions[ordinal], ordinal)),
        });
      }
      if (token === sourceToken.current) {
        await load(survey.id, undefined, token, settingsDirty);
        setMessage('섹션과 질문이 저장되었습니다.');
      }
    } catch (cause) {
      if (token === sourceToken.current) {
        setError(serverMutated ? `일부 변경이 저장되었을 수 있습니다. ${messageFor(cause)}` : messageFor(cause));
      }
    } finally {
      finishMutation(token);
    }
  };
  const addSection = () => { for (const [setter, en] of [[setSurvey, false], [setEnglish, true]] as const) mutate(setter, (s) => ({ ...s, sections: [...s.sections, { id: '', ordinal: s.sections.length, title: { value: en ? 'New section' : '새 섹션', translationUnavailable: false }, questions: [] }] })); };
  const publish = async () => { if (!survey || !editable || settingsDirty || definitionsDirty || !beginMutation()) { if (settingsDirty || definitionsDirty) setError('게시 전에 저장되지 않은 변경사항을 저장해 주세요.'); return; } const token = sourceToken.current; const id = survey.id; setError(''); setMessage(''); try { await surveyApi.publish(id); if (token !== sourceToken.current || id !== surveyId) return; await load(id, undefined, token); if (token === sourceToken.current) setMessage('설문이 게시되었습니다.'); } catch (cause) { if (token === sourceToken.current) setError(messageFor(cause)); } finally { finishMutation(token); } };
  return <section className="min-h-screen bg-[#F7FCFC]"><header className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-[12vw] py-8 text-white"><h1 className="text-[32px] font-extrabold">설문조사 관리</h1></header><nav className="flex gap-4 border-b p-4"><button onClick={() => setTab('settings')}>설정</button><button onClick={() => setTab('questions')} disabled={!survey}>질문</button><Link to="/admin/surveys">목록</Link>{survey && <><button onClick={saveQuestions} disabled={!editable}>질문 저장</button><button onClick={publish} disabled={!editable || dirty}>게시</button></>}</nav><main className="p-8">{error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}{status === 'loading' ? <p role="status">설문을 불러오는 중...</p> : tab === 'settings' ? <div className="grid max-w-2xl gap-4"><label>제목 (한국어)<input value={titleKo} onChange={(e) => { setDirty(true); setTitleKo(e.target.value); }} disabled={!editable} /></label><label>Title (English)<input value={titleEn} onChange={(e) => { setDirty(true); setTitleEn(e.target.value); }} disabled={!editable} /></label><label>설명 (한국어)<textarea value={descriptionKo} onChange={(e) => { setDirty(true); setDescriptionKo(e.target.value); }} disabled={!editable} /></label><label>Description (English)<textarea value={descriptionEn} onChange={(e) => { setDirty(true); setDescriptionEn(e.target.value); }} disabled={!editable} /></label><label>최대 응답<input type="number" min="1" value={cap} onChange={(e) => { setDirty(true); setCap(e.target.value); }} disabled={!editable} /></label><label>회비 제한<select value={feeRestriction} disabled={!editable} onChange={(e) => { setDirty(true); setFeeRestriction(e.target.value as 'ANY' | 'PAID_ONLY'); }}><option value="ANY">제한 없음</option><option value="PAID_ONLY">회비 납부 회원만</option></select></label><label>응답 시작<input type="datetime-local" value={opensAt} onChange={(e) => { setDirty(true); setOpensAt(e.target.value); }} disabled={!editable} /></label><label>응답 마감<input type="datetime-local" value={closesAt} onChange={(e) => { setDirty(true); setClosesAt(e.target.value); }} disabled={!editable} /></label><label>수정 마감<input type="datetime-local" value={editDeadlineAt} onChange={(e) => { setDirty(true); setEditDeadlineAt(e.target.value); }} disabled={!editable} /></label><label>응답 보관 일수<input type="number" min="1" value={retentionDays} onChange={(e) => { setDirty(true); setRetentionDays(e.target.value); }} disabled={!editable} /></label><label><input type="checkbox" checked={guestAllowed} onChange={(e) => { setDirty(true); setGuestAllowed(e.target.checked); if (!e.target.checked) setPhoneRequired(false); }} disabled={!editable} /> 게스트 허용</label><label><input type="checkbox" checked={phoneRequired} onChange={(e) => { setDirty(true); setPhoneRequired(e.target.checked); }} disabled={!editable || !guestAllowed} /> 전화번호 필수</label><button onClick={saveSettings} disabled={!editable || !settingsValid}>설정 저장</button></div> : <div>{survey?.sections.map((section, sectionIndex) => <section key={section.id || sectionIndex} className="mb-6 bg-white p-5"><label>섹션 (한국어)<input value={valueOf(section.title)} disabled={!editable} onChange={(e) => mutate(setSurvey, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, title: { ...item.title, value: e.target.value } } : item) }))} /></label><label>Section (English)<input value={valueOf(english?.sections[sectionIndex]?.title)} disabled={!editable} onChange={(e) => mutate(setEnglish, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, title: { ...item.title, value: e.target.value } } : item) }))} /></label><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, -1) })); mutate(setEnglish, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, -1) })); }} disabled={!editable || sectionIndex === 0} aria-label={`섹션 ${sectionIndex + 1} 위로 이동`}>↑</button><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, 1) })); mutate(setEnglish, (s) => ({ ...s, sections: reorder(s.sections, sectionIndex, 1) })); }} disabled={!editable || sectionIndex === survey.sections.length - 1} aria-label={`섹션 ${sectionIndex + 1} 아래로 이동`}>↓</button><button type="button" onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: s.sections.filter((_, i) => i !== sectionIndex) })); mutate(setEnglish, (s) => ({ ...s, sections: s.sections.filter((_, i) => i !== sectionIndex) })); }} disabled={!editable} aria-label={`섹션 ${sectionIndex + 1} 삭제`}>섹션 삭제</button>{section.questions.map((question, questionIndex) => <QuestionEditor key={question.id || questionIndex} question={question} english={english?.sections[sectionIndex]?.questions[questionIndex]} editable={editable} questionIndex={questionIndex} questionCount={section.questions.length} update={(locale, value) => updateQuestion(sectionIndex, questionIndex, locale, value)} remove={() => { for (const setter of [setSurvey, setEnglish]) mutate(setter, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: item.questions.filter((_, j) => j !== questionIndex) } : item) })); }} move={(offset) => { for (const setter of [setSurvey, setEnglish]) mutate(setter, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: reorder(item.questions, questionIndex, offset) } : item) })); }} />)}{types.map((type) => <button key={type} type="button" aria-label={`섹션 ${sectionIndex + 1}에 ${type} 질문 추가`} onClick={() => { mutate(setSurvey, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: [...item.questions, emptyQuestion(type, false)] } : item) })); mutate(setEnglish, (s) => ({ ...s, sections: s.sections.map((item, i) => i === sectionIndex ? { ...item, questions: [...item.questions, emptyQuestion(type, true)] } : item) })); }} disabled={!editable}>+ {type}</button>)}</section>)}<button type="button" onClick={addSection} disabled={!editable}>+ 섹션</button></div>}</main></section>;
}
