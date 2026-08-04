import { SurveyDefinitionPreview } from '@/components/organisms/survey-definition-preview';
import { SurveyApiError, surveyApi } from '@/lib/survey-api';
import { useDirtyNavigation } from '@/lib/use-dirty-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SurveyBilingualText, SurveyDto, SurveyQuestionDefinitionInput, SurveyQuestionType, SurveySectionItemDefinitionInput } from '@soc/contracts';

const types: SurveyQuestionType[] = ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE'];
const blank = (): SurveyBilingualText => ({ kr: '', en: '' });
const value = (input: { value: string | null } | null | undefined) => input?.value ?? '';
const localId = () => `local-${crypto.randomUUID()}`;
const persistedId = (id: string | undefined) => id && !id.startsWith('local-') ? id : undefined;
const itemQuestion = (type: SurveyQuestionType, id = localId()): SurveyQuestionDefinitionInput => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
  ? { id, ordinal: 0, type, prompt: blank(), required: false, choices: [{ id: localId(), ordinal: 0, value: blank() }] }
  : type === 'NUMBER' ? { id, ordinal: 0, type, prompt: blank(), required: false, numberMin: null, numberMax: null }
  : type === 'DATE' ? { id, ordinal: 0, type, prompt: blank(), required: false, dateMin: null, dateMax: null }
  : { id, ordinal: 0, type, prompt: blank(), required: false, validationRegex: null };
const localInstant = (input: string) => input === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) && !Number.isNaN(new Date(input).getTime());

export function AdminSurveyEditPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const isNew = surveyId === 'new';
  const [survey, setSurvey] = useState<SurveyDto>();
  const [english, setEnglish] = useState<SurveyDto>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(blank());
  const [description, setDescription] = useState(blank());
  const [koreanOnly, setKoreanOnly] = useState(false);
  const [cap, setCap] = useState('');
  const [feeRestriction, setFeeRestriction] = useState<'ANY' | 'PAID_ONLY'>('ANY');
  const [guestAllowed, setGuestAllowed] = useState(false);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [editDeadlineAt, setEditDeadlineAt] = useState('');
  const [retentionDays, setRetentionDays] = useState('365');
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const navigation = useDirtyNavigation(() => definitionDirty || settingsDirty);
  const load = async () => {
    if (!surveyId || isNew) return;
    try {
      const [ko, en] = await Promise.all([surveyApi.getAdmin(surveyId, 'ko'), surveyApi.getAdmin(surveyId, 'en')]);
      setSurvey(ko); setEnglish(en); setTitle({ kr: value(ko.title), en: value(en.title) }); setDescription({ kr: value(ko.description), en: value(en.description) }); setKoreanOnly(Boolean(ko.onlyForKoreanSpeaker)); setCap(ko.cap?.toString() ?? ''); setFeeRestriction(ko.feeRestriction); setGuestAllowed(ko.guestAllowed); setPhoneRequired(ko.phoneRequired); setOpensAt(ko.opensAt?.slice(0, 16) ?? ''); setClosesAt(ko.closesAt?.slice(0, 16) ?? ''); setEditDeadlineAt(ko.editDeadlineAt?.slice(0, 16) ?? ''); setRetentionDays(String(ko.responseRetentionDays)); return ko;
    } catch { setError('설문을 불러올 수 없습니다.'); }
  };
  useEffect(() => { void load(); }, [surveyId]);
  const editable = (isNew || survey?.state === 'DRAFT') && !saving;
  const definition = (source: SurveyDto, preserveLocal = false): Array<{ id?: string; ordinal: number; title: SurveyBilingualText; items: SurveySectionItemDefinitionInput[] }> => source.sections.map((section, sectionIndex) => ({
    ...(persistedId(section.id) ? { id: section.id } : {}), ordinal: sectionIndex, title: { kr: value(section.title), en: value(english?.sections[sectionIndex]?.title) },
    items: section.items.map((item, ordinal): SurveySectionItemDefinitionInput => item.kind === 'QUESTION' ? { ...((preserveLocal ? item.id : persistedId(item.id)) ? { id: item.id } : {}), ordinal, kind: 'QUESTION', question: preserveLocal ? questionInput(item.question, english?.sections[sectionIndex]?.items[ordinal]?.kind === 'QUESTION' ? english.sections[sectionIndex].items[ordinal].question : undefined) : definitionQuestion(questionInput(item.question, english?.sections[sectionIndex]?.items[ordinal]?.kind === 'QUESTION' ? english.sections[sectionIndex].items[ordinal].question : undefined)) } : item.kind === 'DESCRIPTION' ? { ...((preserveLocal ? item.id : persistedId(item.id)) ? { id: item.id } : {}), ordinal, kind: 'DESCRIPTION', body: { kr: value(item.body), en: value(english?.sections[sectionIndex]?.items[ordinal]?.kind === 'DESCRIPTION' ? english.sections[sectionIndex].items[ordinal].body : undefined) } } : { ...((preserveLocal ? item.id : persistedId(item.id)) ? { id: item.id } : {}), ordinal, kind: 'IMAGE_BLOCK', mode: item.mode })
  }));
  const updateItems = (sectionIndex: number, mutate: (items: SurveySectionItemDefinitionInput[]) => SurveySectionItemDefinitionInput[]) => {
    if (!survey || !english) return;
    const sections = definition(survey, true); sections[sectionIndex]!.items = mutate(sections[sectionIndex]!.items).map((item, ordinal) => ({ ...item, ordinal })); setDefinitionDirty(true);
    const apply = (current: SurveyDto, locale: 'ko' | 'en'): SurveyDto => ({ ...current, sections: current.sections.map((section, index) => index !== sectionIndex ? section : ({ ...section, items: sections[index]!.items.map((item) => toDtoItem(item, locale)) } as typeof section)) });
    setSurvey(apply(survey, 'ko')); setEnglish(apply(english, 'en'));
  };
  useEffect(() => { if (navigation.state === 'blocked') { if (window.confirm('저장하지 않은 변경 사항이 있습니다. 이동하면 버려집니다.')) navigation.proceed(); else navigation.reset(); } }, [navigation]);
  const settingsValid = Boolean(title.kr.trim() && title.en.trim() && closesAt) && localInstant(opensAt) && localInstant(closesAt) && localInstant(editDeadlineAt) && (!opensAt || new Date(opensAt) < new Date(closesAt)) && (!editDeadlineAt || new Date(editDeadlineAt) <= new Date(closesAt)) && (!phoneRequired || guestAllowed) && !(feeRestriction === 'PAID_ONLY' && guestAllowed) && (cap === '' || Number.isInteger(Number(cap)) && Number(cap) > 0) && Number.isInteger(Number(retentionDays)) && Number(retentionDays) >= 1 && Number(retentionDays) <= 3650 && Boolean(description.kr.trim()) === Boolean(description.en.trim());
  const saveSettings = async () => {
    if (!editable || !settingsValid) { setError('필수 설정을 확인하세요.'); return; }
    setSaving(true); setError('');
    const input = { title, description: description.kr.trim() || description.en.trim() ? description : null, onlyForKoreanSpeaker: koreanOnly, guestAllowed, phoneRequired, feeRestriction, cap: cap ? Number(cap) : null, opensAt: opensAt ? new Date(opensAt).toISOString() : null, closesAt: new Date(closesAt).toISOString(), editDeadlineAt: editDeadlineAt ? new Date(editDeadlineAt).toISOString() : null, responseRetentionDays: Number(retentionDays) };
    try {
      const next = isNew ? await surveyApi.create(input) : await surveyApi.patch(surveyId!, { ...input, expectedDefinitionVersion: survey!.definitionVersion } as Parameters<typeof surveyApi.patch>[1]);
      setSettingsDirty(false);
      if (isNew) navigate(`/admin/surveys/${next.id}/edit`, { replace: true });
      else if (definitionDirty) setSurvey((current) => current ? { ...current, definitionVersion: next.definitionVersion, title: next.title, description: next.description, onlyForKoreanSpeaker: next.onlyForKoreanSpeaker } : current);
      else { setSurvey(next); await load(); }
    } catch { setError('설정 저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };
  const saveDefinition = async () => {
    if (!survey || !surveyId) return; setSaving(true); setError('');
    try { const result = await surveyApi.replaceDefinition(surveyId, { expectedDefinitionVersion: survey.definitionVersion, sections: definition(survey) }); setSurvey({ ...result.survey, title: survey.title, description: survey.description, onlyForKoreanSpeaker: survey.onlyForKoreanSpeaker }); setEnglish((current) => current && { ...current, definitionVersion: result.survey.definitionVersion }); setDefinitionDirty(false); }
    catch (cause) { setError(cause instanceof SurveyApiError && cause.code === 'stale_definition' ? '다른 변경 사항이 있습니다. 자동으로 다시 불러오지 않았습니다.' : '정의를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  const addSection = () => { if (!survey || !english) return; const ordinal = survey.sections.length; const section = { id: localId(), ordinal, title: { value: '', translationUnavailable: false }, items: [] }; setSurvey({ ...survey, sections: [...survey.sections, section] }); setEnglish({ ...english, sections: [...english.sections, section] }); setDefinitionDirty(true); };
  const publish = async () => { if (!survey || !editable || settingsDirty || definitionDirty) { if (settingsDirty || definitionDirty) setError('게시하기 전에 변경 사항을 저장하세요.'); return; } setSaving(true); try { await surveyApi.publish(survey.id); await load(); } catch { setError('게시하지 못했습니다.'); } finally { setSaving(false); } };
  if (!isNew && !survey) return <main className="p-6">{error || '불러오는 중…'}</main>;
  return <main className="mx-auto max-w-5xl p-6"><Link to="/admin/surveys">목록</Link><h1 className="mt-4 text-2xl font-bold">설문 편집</h1>{error && <p role="alert">{error}</p>}
    <section className="mt-6 rounded border p-4"><h2 className="font-bold">설문 설정</h2><label>한국어 제목<input value={title.kr} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setTitle((old) => ({ ...old, kr: e.target.value, ...(koreanOnly ? { en: e.target.value } : {}) })); }}/></label><label>English title<input value={title.en} readOnly={koreanOnly} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setTitle({ ...title, en: e.target.value }); }}/></label><label>설문 설명<textarea value={description.kr} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setDescription((old) => ({ ...old, kr: e.target.value, ...(koreanOnly ? { en: e.target.value } : {}) })); }}/></label><label>Survey description (English)<textarea value={description.en} readOnly={koreanOnly} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setDescription({ ...description, en: e.target.value }); }}/></label><label>응답 정원<input type="number" value={cap} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setCap(e.target.value); }}/></label><label>참가비 제한<select value={feeRestriction} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setFeeRestriction(e.target.value as 'ANY' | 'PAID_ONLY'); }}><option value="ANY">제한 없음</option><option value="PAID_ONLY">유료 회원만</option></select></label><label>응답 시작<input type="datetime-local" value={opensAt} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setOpensAt(e.target.value); }}/></label><label>응답 마감<input type="datetime-local" value={closesAt} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setClosesAt(e.target.value); }}/></label><label>수정 마감<input type="datetime-local" value={editDeadlineAt} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setEditDeadlineAt(e.target.value); }}/></label><label>보관 기간<input type="number" value={retentionDays} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setRetentionDays(e.target.value); }}/></label><label><input type="checkbox" checked={guestAllowed} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setGuestAllowed(e.target.checked); if (!e.target.checked) setPhoneRequired(false); }}/> 게스트 허용</label><label><input type="checkbox" checked={phoneRequired} disabled={!editable || !guestAllowed} onChange={(e) => { setSettingsDirty(true); setPhoneRequired(e.target.checked); }}/> 전화번호 필수</label><label><input type="checkbox" checked={koreanOnly} disabled={!editable} onChange={(e) => { setSettingsDirty(true); setKoreanOnly(e.target.checked); if (e.target.checked) { setTitle((old) => ({ ...old, en: old.kr })); setDescription((old) => ({ ...old, en: old.kr })); if (survey) { setEnglish({ ...survey, title: { ...survey.title }, description: survey.description ? { ...survey.description } : null }); setDefinitionDirty(true); } } }}/> 한국어 사용자 전용</label><button type="button" disabled={!editable || !settingsValid} onClick={() => void saveSettings()}>설정 저장</button></section>
    {survey && <><section className="mt-6"><button type="button" disabled={!editable} onClick={addSection}>+ 섹션</button><button type="button" disabled={!editable || settingsDirty || definitionDirty} onClick={() => void publish()}>게시</button></section>{survey.sections.map((section, sectionIndex) => <section key={section.id} className="mt-6 rounded border p-4">{definitionDirty && <p role="status">이미지 변경 전에 정의를 저장하세요.</p>}<label>섹션 제목 (한국어)<input value={value(section.title)} disabled={!editable} onChange={(event) => { const next = event.target.value; setDefinitionDirty(true); setSurvey((current) => current && ({ ...current, sections: current.sections.map((candidate, index) => index === sectionIndex ? { ...candidate, title: { ...candidate.title, value: next } } : candidate) })); if (koreanOnly) setEnglish((current) => current && ({ ...current, sections: current.sections.map((candidate, index) => index === sectionIndex ? { ...candidate, title: { ...candidate.title, value: next } } : candidate) })); }}/></label><label>Section title (English)<input value={value(english?.sections[sectionIndex]?.title)} readOnly={koreanOnly} disabled={!editable} onChange={(event) => { setDefinitionDirty(true); setEnglish((current) => current && ({ ...current, sections: current.sections.map((candidate, index) => index === sectionIndex ? { ...candidate, title: { ...candidate.title, value: event.target.value } } : candidate) })); }}/></label><button type="button" disabled={!editable || sectionIndex === 0} onClick={() => { setSurvey({ ...survey, sections: move(survey.sections, sectionIndex, -1).map((item, ordinal) => ({ ...item, ordinal })) }); setEnglish((current) => current && ({ ...current, sections: move(current.sections, sectionIndex, -1).map((item, ordinal) => ({ ...item, ordinal })) })); setDefinitionDirty(true); }}>↑</button><button type="button" disabled={!editable || sectionIndex === survey.sections.length - 1} onClick={() => { setSurvey({ ...survey, sections: move(survey.sections, sectionIndex, 1).map((item, ordinal) => ({ ...item, ordinal })) }); setEnglish((current) => current && ({ ...current, sections: move(current.sections, sectionIndex, 1).map((item, ordinal) => ({ ...item, ordinal })) })); setDefinitionDirty(true); }}>↓</button><button type="button" disabled={!editable} onClick={() => { setSurvey({ ...survey, sections: survey.sections.filter((_, index) => index !== sectionIndex) }); setEnglish((current) => current && ({ ...current, sections: current.sections.filter((_, index) => index !== sectionIndex) })); setDefinitionDirty(true); }}>삭제</button>{section.items.map((item, index) => <div key={item.id}><Insertion onAdd={(kind) => updateItems(sectionIndex, (items) => [...items.slice(0, index), newItem(kind), ...items.slice(index)])}/><ItemEditor item={item} english={english?.sections[sectionIndex]?.items[index]} editable={Boolean(editable)} membershipEditable={Boolean(editable && !definitionDirty)} koreanOnly={koreanOnly} surveyId={survey.id} definitionVersion={survey.definitionVersion} onReload={load} onChange={(next) => updateItems(sectionIndex, (items) => items.map((old, itemIndex) => itemIndex === index ? next : old))} onMove={(offset) => updateItems(sectionIndex, (items) => move(items, index, offset))} onDelete={() => updateItems(sectionIndex, (items) => items.filter((_, itemIndex) => itemIndex !== index))}/></div>)}<Insertion onAdd={(kind) => updateItems(sectionIndex, (items) => [...items, newItem(kind)])}/></section>)}
    <button type="button" disabled={!editable} onClick={() => void saveDefinition()}>정의 저장</button><SurveyDefinitionPreview survey={survey}/></>}</main>;
}
function questionInput(question: SurveyDto['sections'][number]['items'][number] extends never ? never : Extract<SurveyDto['sections'][number]['items'][number], { kind: 'QUESTION' }>['question'], english: Extract<SurveyDto['sections'][number]['items'][number], { kind: 'QUESTION' }>['question'] | undefined): SurveyQuestionDefinitionInput { const base = { id: question.id, ordinal: question.ordinal, prompt: { kr: value(question.prompt), en: value(english?.prompt) }, helpText: question.helpText ? { kr: value(question.helpText), en: value(english?.helpText) } : null, required: question.required }; if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') return { ...base, type: question.type, choices: question.choices.map((choice, index) => ({ id: choice.id, ordinal: index, value: { kr: value(choice.value), en: value(english?.choices[index]?.value) } })) }; if (question.type === 'NUMBER') return { ...base, type: 'NUMBER', numberMin: question.numberMin, numberMax: question.numberMax }; if (question.type === 'DATE') return { ...base, type: 'DATE', dateMin: question.dateMin, dateMax: question.dateMax }; return { ...base, type: question.type, validationRegex: question.validationRegex }; }
function definitionQuestion(question: SurveyQuestionDefinitionInput): SurveyQuestionDefinitionInput {
  const id = persistedId(question.id);
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') return { ...question, ...(id ? { id } : { id: undefined }), choices: question.choices.map((choice) => ({ ...choice, ...(persistedId(choice.id) ? { id: choice.id } : { id: undefined }) })) };
  return { ...question, ...(id ? { id } : { id: undefined }) };
}
function toDtoItem(item: SurveySectionItemDefinitionInput, locale: 'ko' | 'en'): SurveyDto['sections'][number]['items'][number] {
  const localized = (text: SurveyBilingualText) => ({ value: text[locale === 'ko' ? 'kr' : 'en'], translationUnavailable: false });
  const id = item.id ?? localId();
  if (item.kind === 'DESCRIPTION') return { id, ordinal: item.ordinal, kind: 'DESCRIPTION', body: localized(item.body) };
  if (item.kind === 'IMAGE_BLOCK') return { id, ordinal: item.ordinal, kind: 'IMAGE_BLOCK', mode: item.mode, membershipCounts: { shared: 0, ko: 0, en: 0 } };
  const question = item.question;
  const base = { id: question.id ?? localId(), ordinal: question.ordinal, prompt: localized(question.prompt), helpText: question.helpText ? localized(question.helpText) : null, required: question.required };
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') return { id, ordinal: item.ordinal, kind: 'QUESTION', question: { ...base, type: question.type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: question.choices.map((choice) => ({ id: choice.id ?? localId(), ordinal: choice.ordinal, value: localized(choice.value) })) } };
  if (question.type === 'NUMBER') return { id, ordinal: item.ordinal, kind: 'QUESTION', question: { ...base, type: 'NUMBER', validationRegex: null, numberMin: question.numberMin ?? null, numberMax: question.numberMax ?? null, dateMin: null, dateMax: null, choices: [] } };
  if (question.type === 'DATE') return { id, ordinal: item.ordinal, kind: 'QUESTION', question: { ...base, type: 'DATE', validationRegex: null, numberMin: null, numberMax: null, dateMin: question.dateMin ?? null, dateMax: question.dateMax ?? null, choices: [] } };
  return { id, ordinal: item.ordinal, kind: 'QUESTION', question: { ...base, type: question.type, validationRegex: question.validationRegex ?? null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] } };
}
function newItem(kind: 'DESCRIPTION' | 'IMAGE_BLOCK' | 'QUESTION'): SurveySectionItemDefinitionInput { const id = localId(); return kind === 'DESCRIPTION' ? { id, ordinal: 0, kind, body: blank() } : kind === 'IMAGE_BLOCK' ? { id, ordinal: 0, kind, mode: 'SHARED' } : { id, ordinal: 0, kind, question: itemQuestion('SHORT_TEXT') }; }
function move<T>(items: T[], index: number, offset: number): T[] { const target = index + offset; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; return next; }
function Insertion({ onAdd }: { onAdd: (kind: 'DESCRIPTION' | 'IMAGE_BLOCK' | 'QUESTION') => void }) { return <div className="my-2"><button type="button" aria-label="항목 추가" onClick={() => onAdd('QUESTION')}>+</button><button type="button" onClick={() => onAdd('DESCRIPTION')}>설명 추가</button><button type="button" onClick={() => onAdd('IMAGE_BLOCK')}>이미지 추가</button></div>; }
function ItemEditor({ item, english, editable, membershipEditable, koreanOnly, surveyId, definitionVersion, onReload, onChange, onMove, onDelete }: { item: SurveyDto['sections'][number]['items'][number]; english: SurveyDto['sections'][number]['items'][number] | undefined; editable: boolean; membershipEditable: boolean; koreanOnly: boolean; surveyId: string; definitionVersion: number; onReload: () => Promise<void | SurveyDto>; onChange: (item: SurveySectionItemDefinitionInput) => void; onMove: (offset: number) => void; onDelete: () => void }) { const controls = <><button type="button" disabled={!editable} onClick={() => onMove(-1)}>↑</button><button type="button" disabled={!editable} onClick={() => onMove(1)}>↓</button><button type="button" disabled={!editable} onClick={onDelete}>삭제</button></>; if (item.kind === 'DESCRIPTION') { const en = english?.kind === 'DESCRIPTION' ? value(english.body) : ''; return <div className="rounded bg-slate-50 p-3">{controls}<label>설명 (한국어)<textarea required value={value(item.body)} disabled={!editable} onChange={(e) => onChange({ id: item.id, ordinal: item.ordinal, kind: 'DESCRIPTION', body: { kr: e.target.value, en: koreanOnly ? e.target.value : en } })}/></label><label>Description (English)<textarea required value={koreanOnly ? value(item.body) : en} readOnly={koreanOnly} disabled={!editable} onChange={(e) => onChange({ id: item.id, ordinal: item.ordinal, kind: 'DESCRIPTION', body: { kr: value(item.body), en: e.target.value } })}/></label></div>; } if (item.kind === 'IMAGE_BLOCK') return <ImageBlockEditor item={item} editable={membershipEditable} koreanOnly={koreanOnly} surveyId={surveyId} definitionVersion={definitionVersion} onReload={onReload}>{controls}</ImageBlockEditor>; const q = item.question; const en = english?.kind === 'QUESTION' ? english.question : undefined; const input = questionInput(q, en); const patch = (next: SurveyQuestionDefinitionInput) => onChange({ id: item.id, ordinal: item.ordinal, kind: 'QUESTION', question: next }); const localized = (key: 'prompt' | 'helpText', locale: 'kr' | 'en', nextValue: string) => { const current = key === 'prompt' ? input.prompt : input.helpText ?? blank(); patch({ ...input, [key]: { ...current, [locale]: nextValue, ...(koreanOnly && locale === 'kr' ? { en: nextValue } : {}) } } as SurveyQuestionDefinitionInput); }; const choices = 'choices' in input && input.choices ? input.choices : []; return <div className="rounded bg-slate-50 p-3">{controls}<select value={q.type} disabled={!editable} onChange={(e) => patch(itemQuestion(e.target.value as SurveyQuestionType))}>{types.map((type) => <option key={type}>{type}</option>)}</select><label><input type="checkbox" checked={q.required} disabled={!editable} onChange={(e) => patch({ ...input, required: e.target.checked })}/> 필수</label><label>질문 (한국어)<input value={value(q.prompt)} disabled={!editable} onChange={(e) => localized('prompt', 'kr', e.target.value)}/></label><label>Question (English)<input value={koreanOnly ? value(q.prompt) : value(en?.prompt)} readOnly={koreanOnly} disabled={!editable} onChange={(e) => localized('prompt', 'en', e.target.value)}/></label><label>도움말 (한국어)<input value={value(q.helpText)} disabled={!editable} onChange={(e) => localized('helpText', 'kr', e.target.value)}/></label><label>Help text (English)<input value={koreanOnly ? value(q.helpText) : value(en?.helpText)} readOnly={koreanOnly} disabled={!editable} onChange={(e) => localized('helpText', 'en', e.target.value)}/></label>{(q.type === 'SHORT_TEXT' || q.type === 'LONG_TEXT') && <label>검증 정규식<input value={q.validationRegex ?? ''} disabled={!editable} onChange={(e) => patch({ ...input, validationRegex: e.target.value || null } as SurveyQuestionDefinitionInput)}/></label>}{q.type === 'NUMBER' && <><label>최솟값<input type="number" value={q.numberMin ?? ''} disabled={!editable} onChange={(e) => patch({ ...input, numberMin: e.target.value === '' ? null : Number(e.target.value) } as SurveyQuestionDefinitionInput)}/></label><label>최댓값<input type="number" value={q.numberMax ?? ''} disabled={!editable} onChange={(e) => patch({ ...input, numberMax: e.target.value === '' ? null : Number(e.target.value) } as SurveyQuestionDefinitionInput)}/></label></>}{q.type === 'DATE' && <><label>시작일<input type="date" value={q.dateMin ?? ''} disabled={!editable} onChange={(e) => patch({ ...input, dateMin: e.target.value || null } as SurveyQuestionDefinitionInput)}/></label><label>종료일<input type="date" value={q.dateMax ?? ''} disabled={!editable} onChange={(e) => patch({ ...input, dateMax: e.target.value || null } as SurveyQuestionDefinitionInput)}/></label></>}{choices.map((choice, index) => <div key={index}><input aria-label={`선택지 ${index + 1} 한국어`} value={choice.value.kr} disabled={!editable} onChange={(e) => patch({ ...input, choices: choices.map((candidate, choiceIndex) => choiceIndex === index ? { ...candidate, value: { ...candidate.value, kr: e.target.value, ...(koreanOnly ? { en: e.target.value } : {}) } } : candidate) } as SurveyQuestionDefinitionInput)}/><input aria-label={`Choice ${index + 1} English`} value={koreanOnly ? choice.value.kr : choice.value.en} readOnly={koreanOnly} disabled={!editable} onChange={(e) => patch({ ...input, choices: choices.map((candidate, choiceIndex) => choiceIndex === index ? { ...candidate, value: { ...candidate.value, en: e.target.value } } : candidate) } as SurveyQuestionDefinitionInput)}/><button type="button" disabled={!editable} onClick={() => patch({ ...input, choices: choices.filter((_, choiceIndex) => choiceIndex !== index).map((candidate, ordinal) => ({ ...candidate, ordinal })) } as SurveyQuestionDefinitionInput)}>선택지 삭제</button></div>)}{(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && <button type="button" disabled={!editable} onClick={() => patch({ ...input, choices: [...choices, { ordinal: choices.length, value: blank() }] } as SurveyQuestionDefinitionInput)}>선택지 추가</button>}</div>; }
function ImageBlockEditor({ item, editable, koreanOnly, surveyId, definitionVersion, onReload, children }: { item: Extract<SurveyDto['sections'][number]['items'][number], { kind: 'IMAGE_BLOCK' }>; editable: boolean; koreanOnly: boolean; surveyId: string; definitionVersion: number; onReload: () => Promise<void | SurveyDto>; children: ReactNode }) {
  const [set, setSet] = useState<'SHARED' | 'KO' | 'EN'>(item.mode === 'SHARED' ? 'SHARED' : 'KO');
  const [memberships, setMemberships] = useState<Array<{ id: string; asset: { id: string; src: string } }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(definitionVersion);
  const generation = useRef(0);
  useEffect(() => { version.current = Math.max(version.current, definitionVersion); }, [definitionVersion]);
  useEffect(() => { setSet(item.mode === 'SHARED' ? 'SHARED' : 'KO'); }, [item.mode]);
  const mutation = () => crypto.randomUUID();
  const page = async (next?: string, current = generation.current) => {
    try {
      const result = await surveyApi.imageMemberships(surveyId, item.id, { set, limit: 20, ...(next ? { cursor: next } : {}) });
      if (current !== generation.current) return;
      setMemberships((old) => next ? [...old, ...result.items] : result.items);
      setCursor(result.nextCursor);
      setError('');
    } catch {
      if (current === generation.current) setError('이미지를 불러오지 못했습니다.');
    }
  };
  useEffect(() => {
    const current = ++generation.current;
    setMemberships([]); setCursor(null); setError('');
    if (item.id) void page(undefined, current);
    return () => { if (generation.current === current) generation.current += 1; };
  }, [item.id, set]);
  const run = async (work: () => Promise<{ definitionVersion: number }>) => {
    setBusy(true); setError('');
    try {
      const result = await work();
      version.current = result.definitionVersion;
      await onReload();
      await page();
    } catch (cause) {
      if (cause instanceof SurveyApiError && cause.code === 'stale_definition') {
        const authoritative = await onReload();
        if (authoritative) version.current = authoritative.definitionVersion;
        const current = ++generation.current;
        setMemberships([]); setCursor(null);
        await page(undefined, current);
        setError('다른 변경 사항을 불러왔습니다. 다시 수정하세요.');
      } else setError('이미지 변경을 저장하지 못했습니다.');
    } finally { setBusy(false); }
  };
  const persisted = Boolean(item.id && !item.id.startsWith('local-'));
  const membershipMutationDisabled = !editable || busy || (koreanOnly && set === 'EN');
  const activeCount = set === 'SHARED' ? item.membershipCounts.shared : set === 'KO' ? item.membershipCounts.ko : item.membershipCounts.en;
  return <div className="rounded bg-slate-50 p-3">{children}
    <label>이미지 모드 <select value={item.mode} disabled={!editable || busy} onChange={(event) => {
      const mode = event.target.value as 'SHARED' | 'LOCALIZED';
      if (mode === 'SHARED' && set === 'SHARED') return;
      const retainSet: 'KO' | 'EN' | undefined = mode === 'SHARED' && set !== 'SHARED' ? set : undefined;
      void run(() => surveyApi.changeImageBlockMode(surveyId, item.id, { expectedDefinitionVersion: version.current, clientMutationId: mutation(), mode, ...(retainSet ? { retainSet } : {}) }));
    }}><option value={item.mode}>{item.mode}</option><option value={item.mode === 'SHARED' ? 'LOCALIZED' : 'SHARED'}>{item.mode === 'SHARED' ? 'LOCALIZED' : 'SHARED'}</option></select></label>
    {item.mode === 'LOCALIZED' && <label>세트 <select value={set} disabled={!editable || busy} onChange={(event) => setSet(event.target.value as 'KO' | 'EN')}><option value="KO">KO</option><option value="EN">EN</option></select></label>}
    <p>이미지 {activeCount}개</p>
    {!persisted && <p>이미지 변경 전에 정의를 저장하세요.</p>}
    <input aria-label="이미지 업로드" type="file" accept="image/*" multiple disabled={membershipMutationDisabled} onChange={(event) => {
      const files = [...(event.target.files ?? [])];
      void files.reduce(async (previous, file) => { await previous; await run(async () => {
        const asset = await surveyApi.uploadSurveyImage(file);
        return surveyApi.addImageMembership(surveyId, item.id, { expectedDefinitionVersion: version.current, clientMutationId: mutation(), set, assetId: asset.id });
      }); }, Promise.resolve());
      event.currentTarget.value = '';
    }}/>
    {memberships.map((membership, index) => <div key={membership.id}><img src={membership.asset.src} alt="" className="h-16 w-16 object-cover"/>
      <button type="button" disabled={membershipMutationDisabled} onClick={() => void run(() => surveyApi.removeImageMembership(surveyId, item.id, membership.id, { expectedDefinitionVersion: version.current, clientMutationId: mutation() }))}>삭제</button>
      <button type="button" disabled={membershipMutationDisabled || index === 0} onClick={() => void run(() => surveyApi.moveImageMembership(surveyId, item.id, membership.id, { expectedDefinitionVersion: version.current, clientMutationId: mutation(), afterMembershipId: memberships[index - 2]?.id ?? null }))}>↑</button>
      <button type="button" disabled={membershipMutationDisabled || index === memberships.length - 1} onClick={() => void run(() => surveyApi.moveImageMembership(surveyId, item.id, membership.id, { expectedDefinitionVersion: version.current, clientMutationId: mutation(), afterMembershipId: memberships[index + 1]?.id ?? null }))}>↓</button>
    </div>)}
    {cursor && <button type="button" disabled={!editable || busy} onClick={() => void page(cursor)}>더 보기</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
