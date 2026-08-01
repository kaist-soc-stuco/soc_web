import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReplaceSectionQuestionsRequest, SurveyChoiceOptionDto, SurveyDto, SurveyQuestionType } from '@soc/contracts';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSurveyEditPage } from '@/pages/admin-survey-edit-page';
import { AdminSurveysPage } from '@/pages/admin-surveys-page';
import { EventSurveyPage } from '@/pages/event-survey-page';

const SurveyApiError = vi.hoisted(() => class extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) {
    super(message ?? `HTTP ${status}`);
  }
});
const api = vi.hoisted(() => ({
  aggregate: vi.fn(),
  create: vi.fn(),
  export: vi.fn(),
  get: vi.fn(),
  session: vi.fn(),
  list: vi.fn(),
  listAdmin: vi.fn(),
  mine: vi.fn(),
  patch: vi.fn(),
  publish: vi.fn(),
  replaceQuestions: vi.fn(),
  replaceSections: vi.fn(),
  related: vi.fn(),
  submit: vi.fn(),
}));
vi.mock('@/lib/survey-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/survey-api')>()), SurveyApiError, surveyApi: api }));

const localized = (value: string) => ({ value, translationUnavailable: false });
type Question = SurveyDto['sections'][number]['questions'][number];
type TextQuestion = Question & { type: 'SHORT_TEXT' | 'LONG_TEXT' };
type ChoiceQuestion = Question & { type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' };
type NumberQuestion = Question & { type: 'NUMBER' };
type DateQuestion = Question & { type: 'DATE' };
type TextQuestionOptions = { validationRegex?: string | null };
type ChoiceQuestionOptions = { choices?: SurveyChoiceOptionDto[] };
type NumberQuestionOptions = { numberMin?: number | null; numberMax?: number | null };
type DateQuestionOptions = { dateMin?: string | null; dateMax?: string | null };

function question(id: string, type: 'SHORT_TEXT' | 'LONG_TEXT', prompt: string, required?: boolean, options?: TextQuestionOptions): TextQuestion;
function question(id: string, type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE', prompt: string, required?: boolean, options?: ChoiceQuestionOptions): ChoiceQuestion;
function question(id: string, type: 'NUMBER', prompt: string, required?: boolean, options?: NumberQuestionOptions): NumberQuestion;
function question(id: string, type: 'DATE', prompt: string, required?: boolean, options?: DateQuestionOptions): DateQuestion;
function question(id: string, type: SurveyQuestionType, prompt: string, required = false, options: TextQuestionOptions | ChoiceQuestionOptions | NumberQuestionOptions | DateQuestionOptions = {}): Question {
  const base = { id, ordinal: 0, prompt: localized(prompt), helpText: null, required };
  switch (type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      return { ...base, type, validationRegex: 'validationRegex' in options ? options.validationRegex ?? null : null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] };
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: 'choices' in options ? options.choices ?? [{ id: `${id}-one`, ordinal: 0, value: localized('첫 선택지') }, { id: `${id}-two`, ordinal: 1, value: localized('둘째 선택지') }] : [{ id: `${id}-one`, ordinal: 0, value: localized('첫 선택지') }, { id: `${id}-two`, ordinal: 1, value: localized('둘째 선택지') }] };
    case 'NUMBER':
      return { ...base, type, validationRegex: null, numberMin: 'numberMin' in options ? options.numberMin ?? null : null, numberMax: 'numberMax' in options ? options.numberMax ?? null : null, dateMin: null, dateMax: null, choices: [] };
    case 'DATE':
      return { ...base, type, validationRegex: null, numberMin: null, numberMax: null, dateMin: 'dateMin' in options ? options.dateMin ?? null : null, dateMax: 'dateMax' in options ? options.dateMax ?? null : null, choices: [] };
  }
}

const survey = (overrides: Partial<SurveyDto> = {}): SurveyDto => ({
  id: 'survey-1', revision: 1, locale: 'ko', title: localized('학생 설문'), description: localized('설명'), state: 'OPEN',
  guestAllowed: true, phoneRequired: true, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null,
  editDeadlineAt: null, responseRetentionDays: 365, updatedAt: '2026-07-27T00:00:00.000Z',
  sections: [{ id: 'section-1', ordinal: 0, title: localized('기본 정보'), questions: [
    question('short', 'SHORT_TEXT', '짧은 답변', true), question('long', 'LONG_TEXT', '긴 답변'),
    question('single', 'SINGLE_CHOICE', '하나 선택'), question('multiple', 'MULTIPLE_CHOICE', '여러 개 선택'),
    question('number', 'NUMBER', '숫자'), question('date', 'DATE', '날짜'),
  ] }],
  ...overrides,
});
const authenticatedResponse = {
  response: {
    id: 'response-1',
    state: 'SUBMITTED',
    answers: [],
    submittedAt: '2026-07-27T00:00:00.000Z',
    reviewedAt: null,
    reviewReason: null,
    phonePresent: false,
    maskedPhone: null,
  },
};

const renderSurvey = (id = 'survey-1') => render(
  <MemoryRouter initialEntries={[`/survey/${id}`]}><Routes><Route path="/survey/:surveyId" element={<EventSurveyPage />} /></Routes></MemoryRouter>,
);

const renderAdminEdit = (id = 'survey-1') => render(
  <MemoryRouter initialEntries={[`/admin/surveys/${id}/edit`]}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage />} /></Routes></MemoryRouter>,
);

beforeEach(() => {
  api.session.mockResolvedValue({ authenticated: false });
  api.mine.mockResolvedValue({ response: null });
  api.related.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
  Object.values(api).forEach((method) => method.mockReset());
});

describe('survey pages', () => {
  it('loads a direct survey route, renders all six controls, validates required answers, and submits a guest phone payload', async () => {
    api.get.mockResolvedValue(survey());
    api.submit.mockResolvedValue({ status: 'ACCEPTED' });

    renderSurvey();

    expect(await screen.findByRole('heading', { name: '학생 설문' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /짧은 답변/ })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /긴 답변/ })).toBeVisible();
    expect(screen.getByRole('spinbutton')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '전화번호' })).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByLabelText('날짜')).toHaveAttribute('type', 'date');

    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    expect(api.submit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /짧은 답변/ }), { target: { value: '답변' } });
    fireEvent.change(screen.getByLabelText('전화번호'), { target: { value: '+821012345678' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('radio', { name: '첫 선택지' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '둘째 선택지' }));
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('survey-1', {
      guestPhone: '+821012345678', answers: [
        { questionId: 'short', textValue: '답변' }, { questionId: 'single', choiceOptionIds: ['single-one'] },
        { questionId: 'multiple', choiceOptionIds: ['multiple-two'] }, { questionId: 'number', numberValue: 7 },
        { questionId: 'date', dateValue: '2026-08-01' },
      ],
    }));
    expect(screen.getByText('응답이 제출되었습니다.')).toBeVisible();
  });
  it('renders first and duplicate guest acceptance identically without disclosing response state', async () => {
    const submitGuest = async () => {
      api.get.mockResolvedValue(survey());
      api.submit.mockResolvedValue({ status: 'ACCEPTED' });
      const view = renderSurvey();
      await screen.findByRole('heading', { name: '학생 설문' });
      fireEvent.change(screen.getByRole('textbox', { name: /짧은 답변/ }), { target: { value: '답변' } });
      fireEvent.change(screen.getByLabelText('전화번호'), { target: { value: '+821012345678' } });
      fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
      const success = await screen.findByRole('status');
      const result = success.textContent;
      view.unmount();
      return result;
    };

    const first = await submitGuest();
    const duplicate = await submitGuest();

    expect(first).toBe('응답이 제출되었습니다.');
    expect(duplicate).toBe(first);
    expect(screen.queryByText(/이미.*응답/)).not.toBeInTheDocument();
  });

  it.each([
    ['OPEN', null, null, true, ''],
    ['OPEN', '2099-01-01T00:00:00.000Z', null, false, '아직 응답 기간이 아닙니다.'],
    ['OPEN', null, '2020-01-01T00:00:00.000Z', false, '마감된 설문입니다.'],
    ['CLOSED', null, null, false, '마감된 설문입니다.'],
  ] as const)('makes a %s survey available only within its response window', async (state, opensAt, closesAt, enabled, message) => {
    api.get.mockResolvedValue(survey({ state, opensAt, closesAt }));
    renderSurvey();

    await screen.findByRole('heading', { name: '학생 설문' });
    if (enabled) expect(screen.getByRole('button', { name: '응답 제출' })).toBeEnabled();
    else {
      expect(screen.getByRole('status')).toHaveTextContent(message);
      expect(screen.queryByRole('button', { name: '응답 제출' })).not.toBeInTheDocument();
    }
  });

  it('does not require or send a phone number merely because guest responses are allowed', async () => {
    api.get.mockResolvedValue(survey({ guestAllowed: true, phoneRequired: false }));
    api.submit.mockResolvedValue({ status: 'ACCEPTED' });
    renderSurvey();

    await screen.findByRole('heading', { name: '학생 설문' });
    expect(screen.queryByRole('textbox', { name: '전화번호' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /짧은 답변/ }), { target: { value: '답변' } });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('survey-1', {
      answers: [{ questionId: 'short', textValue: '답변' }],
    }));
  });

  it('shows unavailable and API-error states without allowing a response', async () => {
    api.get.mockResolvedValueOnce(survey({ state: 'CLOSED' }));
    const { unmount } = renderSurvey();
    expect(await screen.findByText('마감된 설문입니다.')).toBeVisible();
    expect(screen.queryByRole('button', { name: '응답 제출' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /짧은 답변/ })).toBeDisabled();
    unmount();

    api.get.mockRejectedValueOnce(new Error('unavailable'));
    renderSurvey('missing');
    expect(await screen.findByText('설문을 불러오지 못했습니다.')).toBeVisible();
  });
  it('blocks submission during an auth-session outage rather than treating it as a guest session', async () => {
    api.get.mockResolvedValue(survey());
    api.session.mockRejectedValue(new TypeError('offline'));

    renderSurvey();

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 상태를 확인할 수 없어 응답할 수 없습니다.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '응답 제출' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /짧은 답변/ })).toBeDisabled();
  });

  it.each([
    ['survey_cap_reached', '응답 정원에 도달했습니다.'],
    ['duplicate_response', '이미 이 설문에 응답했습니다.'],
    ['paid_only', '회비 납부 회원만 응답할 수 있습니다.'],
    ['invalid_answers', '입력값이 설문 조건을 충족하지 않습니다.'],
  ])('renders the %s submit error at the public boundary', async (code, message) => {
    api.get.mockResolvedValue(survey());
    api.session.mockResolvedValue({ authenticated: true });
    api.submit.mockRejectedValue(new SurveyApiError(422, code));

    renderSurvey();
    await screen.findByRole('heading', { name: '학생 설문' });
    fireEvent.change(screen.getByRole('textbox', { name: /짧은 답변/ }), { target: { value: '답변' } });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('enforces each question control constraint and serializes a direct English response by modality', async () => {
    const english = survey({
      locale: 'en', title: localized('Student survey'), description: localized('Description'),
      sections: [{ id: 'section-1', ordinal: 0, title: localized('Basics'), questions: [
        question('short', 'SHORT_TEXT', 'Short answer', true, { validationRegex: '^[A-Z]+$' }),
        question('long', 'LONG_TEXT', 'Long answer', false, { validationRegex: '^[A-Za-z ]+$' }),
        question('single', 'SINGLE_CHOICE', 'One choice', true, { choices: [
          { id: 'single-one', ordinal: 0, value: localized('First choice') },
          { id: 'single-two', ordinal: 1, value: localized('Second choice') },
        ] }),
        question('multiple', 'MULTIPLE_CHOICE', 'Many choices'),
        question('number', 'NUMBER', 'Number', false, { numberMin: 2, numberMax: 8 }),
        question('date', 'DATE', 'Date', false, { dateMin: '2026-08-01', dateMax: '2026-08-31' }),
      ] }],
    });
    api.get.mockResolvedValue(english);
    api.session.mockResolvedValue({ authenticated: true });
    api.submit.mockResolvedValue(authenticatedResponse);

    renderSurvey();
    expect(await screen.findByRole('heading', { name: 'Student survey' })).toBeVisible();
    const shortInput = screen.getByRole('textbox', { name: 'Short answer' });
    const longInput = screen.getByRole('textbox', { name: 'Long answer' });
    expect(screen.getByRole('spinbutton', { name: 'Number' })).toHaveAttribute('min', '2');
    expect(screen.getByRole('spinbutton', { name: 'Number' })).toHaveAttribute('max', '8');
    expect(screen.getByLabelText('Date')).toHaveAttribute('min', '2026-08-01');
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-08-31');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);

    fireEvent.change(shortInput, { target: { value: 'lowercase' } });
    fireEvent.change(longInput, { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    expect(api.submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Short answer' }), { target: { value: 'ANSWER' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Long answer' }), { target: { value: 'long answer' } });
    fireEvent.click(screen.getByRole('radio', { name: 'First choice' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '둘째 선택지' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Number' }), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-02' } });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('survey-1', {
      answers: [
        { questionId: 'short', textValue: 'ANSWER' }, { questionId: 'long', textValue: 'long answer' },
        { questionId: 'single', choiceOptionIds: ['single-one'] }, { questionId: 'multiple', choiceOptionIds: ['multiple-two'] },
        { questionId: 'number', numberValue: 7 }, { questionId: 'date', dateValue: '2026-08-02' },
      ],
    }));
  });
  it('persists every question modality across all sections with complete bilingual definitions', async () => {
    const first = survey().sections[0];
    const second = { ...first, id: 'section-2', ordinal: 1, title: localized('추가 정보'), questions: [
      question('q2', 'DATE', '추가 날짜', false, { dateMin: '2026-09-01', dateMax: '2026-09-30' }),
    ] };
    const draft = survey({ id: 'multi', state: 'DRAFT', sections: [{ ...first, questions: first.questions.map((item, ordinal) => ({ ...item, ordinal })) }, second] });
    const savedFirstQuestions = {
      questions: [
        { ordinal: 0, prompt: { kr: '짧은 답변', en: '짧은 답변' }, helpText: null, type: 'SHORT_TEXT', required: true, validationRegex: null },
        { ordinal: 1, prompt: { kr: '긴 답변', en: '긴 답변' }, helpText: null, type: 'LONG_TEXT', required: false, validationRegex: null },
        { ordinal: 2, prompt: { kr: '하나 선택', en: '하나 선택' }, helpText: null, type: 'SINGLE_CHOICE', required: false, choices: [{ ordinal: 0, value: { kr: '첫 선택지', en: '첫 선택지' } }, { ordinal: 1, value: { kr: '둘째 선택지', en: '둘째 선택지' } }] },
        { ordinal: 3, prompt: { kr: '여러 개 선택', en: '여러 개 선택' }, helpText: null, type: 'MULTIPLE_CHOICE', required: false, choices: [{ ordinal: 0, value: { kr: '첫 선택지', en: '첫 선택지' } }, { ordinal: 1, value: { kr: '둘째 선택지', en: '둘째 선택지' } }] },
        { ordinal: 4, prompt: { kr: '숫자', en: '숫자' }, helpText: null, type: 'NUMBER', required: false, numberMin: null, numberMax: null },
        { ordinal: 5, prompt: { kr: '날짜', en: '날짜' }, helpText: null, type: 'DATE', required: false, dateMin: null, dateMax: null },
      ],
    } satisfies ReplaceSectionQuestionsRequest;
    const savedSecondQuestions = {
      questions: [{ ordinal: 0, prompt: { kr: '추가 날짜', en: '추가 날짜' }, helpText: null, type: 'DATE', required: false, dateMin: '2026-09-01', dateMax: '2026-09-30' }],
    } satisfies ReplaceSectionQuestionsRequest;
    api.get.mockResolvedValue(draft);
    api.replaceSections.mockResolvedValue({ ...draft, sections: [{ ...draft.sections[0], id: 'saved-one' }, { ...draft.sections[1], id: 'saved-two' }] });
    api.replaceQuestions.mockResolvedValue(draft);

    renderAdminEdit('multi');
    await screen.findByRole('button', { name: '질문' });
    fireEvent.click(screen.getByRole('button', { name: '질문' }));
    fireEvent.click(screen.getByRole('button', { name: '질문 저장' }));

    await waitFor(() => expect(api.replaceSections).toHaveBeenCalledWith('multi', {
      sections: [
        { ordinal: 0, title: { kr: '기본 정보', en: '기본 정보' } },
        { ordinal: 1, title: { kr: '추가 정보', en: '추가 정보' } },
      ],
    }));
    await waitFor(() => expect(api.replaceQuestions).toHaveBeenCalledTimes(2));
    expect(api.replaceQuestions).toHaveBeenNthCalledWith(1, 'saved-one', savedFirstQuestions);
    expect(api.replaceQuestions).toHaveBeenNthCalledWith(2, 'saved-two', savedSecondQuestions);
  });

  it('keeps published surveys immutable', async () => {
    api.get.mockResolvedValue(survey({ state: 'OPEN' }));
    renderAdminEdit();
    expect(await screen.findByRole('textbox', { name: '제목 (한국어)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '설정 저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '게시' })).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
  });
  it('reports a failed admin write without claiming that settings were saved', async () => {
    api.get.mockResolvedValue(survey({ state: 'DRAFT', closesAt: '2026-12-31T23:59:00.000Z' }));
    api.patch.mockRejectedValue(new SurveyApiError(422, 'invalid_survey_definition'));

    renderAdminEdit();
    await screen.findByRole('textbox', { name: '제목 (한국어)' });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    expect(await screen.findByText('설정 저장에 실패했습니다.')).toBeVisible();
    expect(screen.queryByText('설정이 저장되었습니다.')).not.toBeInTheDocument();
  });
  it('keeps guest permission and phone collection as independent settings', async () => {
    const draft = survey({ state: 'DRAFT', closesAt: '2026-12-31T23:59:00.000Z', guestAllowed: false, phoneRequired: false });
    api.get.mockResolvedValue(draft);
    api.patch.mockResolvedValue({ ...draft, guestAllowed: true, phoneRequired: false });

    renderAdminEdit();
    await screen.findByRole('checkbox', { name: /게스트 허용/ });
    fireEvent.click(screen.getByRole('checkbox', { name: /게스트 허용/ }));

    expect(screen.getByRole('checkbox', { name: /전화번호 필수/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '설정 저장' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('survey-1', expect.objectContaining({
      guestAllowed: true,
      phoneRequired: false,
    })));
  });

  it('preserves edited settings after a failed settings write', async () => {
    api.get.mockResolvedValue(survey({ state: 'DRAFT', closesAt: '2026-12-31T23:59:00.000Z' }));
    api.patch.mockRejectedValue(new SurveyApiError(422, 'invalid_survey_definition'));
    renderAdminEdit();

    const koreanTitle = await screen.findByRole('textbox', { name: '제목 (한국어)' });
    fireEvent.change(koreanTitle, { target: { value: '저장 실패 후 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('설정 저장에 실패했습니다.');
    expect(koreanTitle).toHaveValue('저장 실패 후 제목');
  });

  it('preserves edited bilingual question values after a failed section write and exposes reorder labels', async () => {
    const draft = survey({ state: 'DRAFT', closesAt: '2026-12-31T23:59:00.000Z' });
    api.get.mockResolvedValue(draft);
    api.replaceSections.mockRejectedValue(new SurveyApiError(422, 'invalid_survey_definition'));
    renderAdminEdit();

    await screen.findByRole('button', { name: '질문' });
    fireEvent.click(screen.getByRole('button', { name: '질문' }));
    const koreanQuestion = screen.getAllByRole<HTMLInputElement>('textbox', { name: '질문 (한국어)' })
      .find((input) => input.value === '짧은 답변')!;
    const englishQuestion = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Question (English)' })
      .find((input) => input.value === '짧은 답변')!;
    fireEvent.change(koreanQuestion, { target: { value: '수정한 질문' } });
    fireEvent.change(englishQuestion, { target: { value: 'Edited question' } });
    fireEvent.click(screen.getByRole('button', { name: '질문 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/저장에 실패했습니다/);
    expect(koreanQuestion).toHaveValue('수정한 질문');
    expect(englishQuestion).toHaveValue('Edited question');
    expect(screen.getByRole('button', { name: '질문 1 위로 이동' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '질문 1 아래로 이동' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '섹션 1 위로 이동' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '섹션 1 아래로 이동' })).toBeDisabled();
  });
  it('keeps authenticated controls disabled until the existing response is prefilled', async () => {
    let resolveMine!: (value: unknown) => void;
    api.get.mockResolvedValue(survey({ editDeadlineAt: '2099-01-01T00:00:00.000Z' }));
    api.session.mockResolvedValue({ authenticated: true });
    api.mine.mockReturnValue(new Promise<unknown>((resolve) => { resolveMine = resolve; }));
    renderSurvey();
    const shortInput = await screen.findByRole('textbox', { name: /짧은 답변/ });
    expect(shortInput).toBeDisabled();
    resolveMine({ response: { ...authenticatedResponse.response, answers: [{ questionId: 'short', textValue: '저장된 답변' }] } });
    await waitFor(() => expect(shortInput).toHaveValue('저장된 답변'));
    expect(shortInput).toBeEnabled();
  });
  it.each([
    ['SUBMITTED', '2099-01-01T00:00:00.000Z', true],
    ['SUBMITTED', null, false],
    ['APPROVED', '2099-01-01T00:00:00.000Z', false],
  ] as const)('permits an existing %s response edit only with a future deadline', async (state, editDeadlineAt, enabled) => {
    api.get.mockResolvedValue(survey({ editDeadlineAt }));
    api.session.mockResolvedValue({ authenticated: true });
    api.mine.mockResolvedValue({ response: { ...authenticatedResponse.response, state } });
    renderSurvey();
    const shortInput = await screen.findByRole('textbox', { name: /짧은 답변/ });
    await waitFor(() => enabled ? expect(shortInput).toBeEnabled() : expect(shortInput).toBeDisabled());
  });
  it('rejects UTF-8 text answers above 8,192 bytes', async () => {
    api.get.mockResolvedValue(survey({ guestAllowed: true, phoneRequired: false }));
    api.submit.mockResolvedValue({ status: 'ACCEPTED' });
    renderSurvey();
    const shortInput = await screen.findByRole('textbox', { name: /짧은 답변/ });
    fireEvent.change(shortInput, { target: { value: '가'.repeat(2_731) } });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('8,192바이트');
    expect(api.submit).not.toHaveBeenCalled();
  });
  it('preserves the complete dirty bilingual draft after the second section question save fails', async () => {
    const first = survey().sections[0];
    const draft = survey({ state: 'DRAFT', closesAt: '2026-12-31T23:59:00.000Z', sections: [first, { ...first, id: 'section-2', ordinal: 1, title: localized('두 번째'), questions: [question('second-short', 'SHORT_TEXT', '두 번째 질문')] }] });
    api.get.mockResolvedValue(draft);
    api.replaceSections.mockResolvedValue({ ...draft, sections: [{ ...first, id: 'saved-one' }, { ...draft.sections[1], id: 'saved-two' }] });
    api.replaceQuestions.mockResolvedValueOnce(draft).mockRejectedValueOnce(new SurveyApiError(422, 'invalid_survey_definition'));
    renderAdminEdit();
    await screen.findByRole('button', { name: '질문' });
    fireEvent.click(screen.getByRole('button', { name: '질문' }));
    const englishQuestion = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Question (English)' }).find((input) => input.value === '두 번째 질문')!;
    fireEvent.change(englishQuestion, { target: { value: 'Unsaved second question' } });
    fireEvent.click(screen.getByRole('button', { name: '질문 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('일부 변경이 저장되었을 수 있습니다.');
    expect(englishQuestion).toHaveValue('Unsaved second question');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: '게시' })).toBeDisabled();
  });

  it('creates and edits a survey, persists sections and questions, and publishes it', async () => {
    const created = survey({ id: 'created', state: 'DRAFT', sections: [], closesAt: '2026-12-31T23:59:00.000Z' });
    api.get.mockResolvedValue(created);
    api.create.mockResolvedValue(created);
    api.patch.mockResolvedValue(created);
    api.replaceSections.mockResolvedValue(survey({ id: 'created', state: 'DRAFT', sections: [{ ...survey().sections[0], questions: [] }] }));
    api.replaceQuestions.mockResolvedValue(created);
    api.publish.mockResolvedValue({ survey: survey({ id: 'created', state: 'OPEN' }) });

    render(<MemoryRouter initialEntries={['/admin/surveys/new/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage />} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: '제목 (한국어)' }), { target: { value: '새 설문' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Title (English)' }), { target: { value: 'New survey' } });
    fireEvent.change(screen.getByLabelText('응답 마감'), { target: { value: '2026-12-31T23:59' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /게스트 허용/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /전화번호 필수/ }));
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ title: { kr: '새 설문', en: 'New survey' }, guestAllowed: true, phoneRequired: true })));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('created', 'en', expect.any(AbortSignal)));
    await screen.findByRole('textbox', { name: 'Title (English)' });
    fireEvent.change(screen.getByRole('textbox', { name: '제목 (한국어)' }), { target: { value: '수정된 설문' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Title (English)' }), { target: { value: 'Updated survey' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('created', expect.objectContaining({ title: { kr: '수정된 설문', en: 'Updated survey' } })));

    fireEvent.click(screen.getByRole('button', { name: '질문' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 섹션' }));
    fireEvent.click(screen.getByRole('button', { name: '섹션 1에 SHORT_TEXT 질문 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '질문 저장' }));
    await waitFor(() => expect(api.replaceSections).toHaveBeenCalledWith('created', expect.any(Object)));
    await waitFor(() => expect(api.replaceQuestions).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '게시' }));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith('created'));

  });

  it('loads the admin list from the API rather than fixture data', async () => {
    api.listAdmin.mockResolvedValue({ locale: 'ko', items: [survey()] });
    render(<MemoryRouter><AdminSurveysPage /></MemoryRouter>);
    expect(await screen.findByText('학생 설문')).toBeVisible();
    expect(screen.getByRole('link', { name: '편집' })).toHaveAttribute('href', '/admin/surveys/survey-1/edit');
  });
});
