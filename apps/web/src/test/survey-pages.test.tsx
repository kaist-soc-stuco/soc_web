import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SurveyDto } from '@soc/contracts';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminSurveyEditPage } from '@/pages/admin-survey-edit-page';
import { EventSurveyPage } from '@/pages/event-survey-page';

const api = vi.hoisted(() => ({ get: vi.fn(), getAdmin: vi.fn(), create: vi.fn(), patch: vi.fn(), publish: vi.fn(), replaceDefinition: vi.fn(), submit: vi.fn(), session: vi.fn().mockResolvedValue({ authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null }), mine: vi.fn().mockResolvedValue({ response: null }), publicImageMemberships: vi.fn(), imageMemberships: vi.fn(), uploadSurveyImage: vi.fn(), addImageMembership: vi.fn(), removeImageMembership: vi.fn(), moveImageMembership: vi.fn(), changeImageBlockMode: vi.fn() }));
vi.mock('@/lib/survey-api', () => ({ surveyApi: api, SurveyApiError: class SurveyApiError extends Error {} }));
vi.mock('@/lib/locale-store', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/locale-store')>()), useLocale: () => ['en', vi.fn()] as const }));
vi.mock('@/lib/use-dirty-navigation', () => ({ useDirtyNavigation: () => ({ state: 'unblocked' }) }));
const localized = (value: string) => ({ value, translationUnavailable: false });
const question = { id: 'item-q-1', ordinal: 0, kind: 'QUESTION' as const, question: { id: 'q-1', ordinal: 0, prompt: localized('Question'), helpText: null, type: 'SHORT_TEXT' as const, required: false, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] as [] } };
const survey = (overrides: Partial<SurveyDto> = {}): SurveyDto => ({ id: 'survey-1', revision: 1, definitionVersion: 1, locale: 'en', requestedLocale: 'en', effectiveContentLocale: 'ko', onlyForKoreanSpeaker: true, title: localized('설문'), description: localized('설명'), state: 'DRAFT', guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365, sections: [{ id: 'section-1', ordinal: 0, title: localized('섹션'), items: [question, { id: 'description-1', ordinal: 1, kind: 'DESCRIPTION', body: localized('안내') }, { id: 'images-1', ordinal: 2, kind: 'IMAGE_BLOCK', mode: 'SHARED', membershipCounts: { shared: 2, ko: 0, en: 0 } }] }], updatedAt: null, ...overrides });
afterEach(() => { cleanup(); vi.clearAllMocks(); api.session.mockResolvedValue({ authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null }); api.mine.mockResolvedValue({ response: null }); });
describe('survey pages', () => {
  it('disables definition mutations for a published survey', async () => {
    const published = survey({ state: 'OPEN' });
    api.getAdmin.mockResolvedValue(published);
    api.imageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' });
    render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>);

    await screen.findByText('설문 편집');
    expect(screen.getByRole('button', { name: '+ 섹션' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '항목 추가' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '설명 추가' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '이미지 추가' })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: '정의 저장' })).toBeDisabled();
    expect(api.replaceDefinition).not.toHaveBeenCalled();
  });

  it('inserts mixed items at an ordered boundary', async () => { api.getAdmin.mockResolvedValue(survey()); api.imageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' }); render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>); await screen.findByText('설문 편집'); fireEvent.click(screen.getAllByRole('button', { name: '이미지 추가' })[0]!); expect(await screen.findByRole('status')).toHaveTextContent('이미지 변경 전에 정의를 저장하세요.'); expect(screen.getAllByText(/이미지 모드/)).toHaveLength(2); });
  it('creates a new survey with lifecycle settings before enabling its mixed editor', async () => {
    const created = survey({ id: 'created', sections: [], closesAt: '2026-12-31T23:59:00.000Z' });
    api.create.mockResolvedValue(created); api.getAdmin.mockResolvedValue(created);
    render(<MemoryRouter initialEntries={['/admin/surveys/new/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('한국어 제목'), { target: { value: '새 설문' } });
    fireEvent.change(screen.getByLabelText('English title'), { target: { value: 'New survey' } });
    fireEvent.change(screen.getByLabelText('응답 마감'), { target: { value: '2026-12-31T23:59' } });
    fireEvent.click(screen.getByLabelText('게스트 허용'));
    fireEvent.click(screen.getByLabelText('전화번호 필수'));
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ guestAllowed: true, phoneRequired: true, title: { kr: '새 설문', en: 'New survey' } })));
    await screen.findByRole('button', { name: '+ 섹션' });
    fireEvent.click(screen.getByRole('button', { name: '+ 섹션' }));
    expect(screen.getByLabelText('섹션 제목 (한국어)')).toBeInTheDocument();
  });
  it('ignores a stale Korean membership response after selecting English', async () => {
    let resolveKo!: (value: any) => void;
    let resolveEn!: (value: any) => void;
    api.getAdmin.mockResolvedValue(survey({ sections: [{
      ...survey().sections[0]!,
      items: [{ id: 'images-1', ordinal: 0, kind: 'IMAGE_BLOCK', mode: 'LOCALIZED', membershipCounts: { shared: 0, ko: 1, en: 1 } }],
    }] }));
    api.imageMemberships.mockImplementation((_a: string, _b: string, query: { set: string }) => new Promise((resolve) => {
      if (query.set === 'KO') resolveKo = resolve;
      else resolveEn = resolve;
    }));
    render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>);
    await screen.findByText('설문 편집');
    fireEvent.change(screen.getByLabelText('세트'), { target: { value: 'EN' } });
    await waitFor(() => expect(resolveEn).toBeTypeOf('function'));
    resolveEn({ items: [{ id: 'en-membership', asset: { id: 'en', src: '/en.png' } }], nextCursor: null, membershipCount: 1, definitionVersion: 1 });
    await waitFor(() => expect(document.querySelector('img[src="/en.png"]')).not.toBeNull());
    resolveKo({ items: [{ id: 'ko-membership', asset: { id: 'ko', src: '/ko.png' } }], nextCursor: null, membershipCount: 1, definitionVersion: 1 });
    await waitFor(() => expect(document.querySelector('img[src="/ko.png"]')).toBeNull());
    expect(document.querySelector('img[src="/en.png"]')).not.toBeNull();
  });
  it('keeps inserted common-list fields editable and omits its local ID when saving', async () => {
    const current = survey();
    api.getAdmin.mockResolvedValue(current);
    api.imageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' });
    api.replaceDefinition.mockResolvedValue({ survey: current });
    render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>);
    await screen.findByText('설문 편집');
    fireEvent.click(screen.getAllByRole('button', { name: '항목 추가' })[0]!);
    const inserted = screen.getAllByLabelText('질문 (한국어)').find((input) => (input as HTMLInputElement).value === '');
    expect(inserted).toBeDefined();
    expect(inserted).not.toBeDisabled();
    fireEvent.change(inserted!, { target: { value: '새 질문' } });
    fireEvent.click(screen.getByRole('button', { name: '정의 저장' }));
    await waitFor(() => expect(api.replaceDefinition).toHaveBeenCalled());
    const payload = api.replaceDefinition.mock.calls[0]![1];
    const created = payload.sections[0].items.find((item: { kind: string; question?: { prompt: { kr: string } } }) => item.kind === 'QUESTION' && item.question?.prompt.kr === '새 질문');
    expect(created).toBeDefined();
    expect(created).not.toHaveProperty('id');
    const retained = payload.sections[0].items.find((item: { id?: string }) => item.id === 'item-q-1');
    expect(retained?.question.id).toBe('q-1');
  });
  it('uses the returned version for each sequential image upload', async () => { api.getAdmin.mockResolvedValue(survey()); api.imageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' }); api.uploadSurveyImage.mockResolvedValueOnce({ id: 'asset-1' }).mockResolvedValueOnce({ id: 'asset-2' }); api.addImageMembership.mockResolvedValueOnce({ definitionVersion: 2, membership: null, membershipCount: 1 }).mockResolvedValueOnce({ definitionVersion: 3, membership: null, membershipCount: 2 }); render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>); await screen.findByText('설문 편집'); const upload = await screen.findByLabelText('이미지 업로드'); fireEvent.change(upload, { target: { files: [new File(['first'], 'first.png', { type: 'image/png' }), new File(['second'], 'second.png', { type: 'image/png' })] } }); await waitFor(() => expect(api.addImageMembership).toHaveBeenCalledTimes(2)); expect(api.addImageMembership.mock.calls[0]![2].expectedDefinitionVersion).toBe(1); expect(api.addImageMembership.mock.calls[1]![2].expectedDefinitionVersion).toBe(2); });
  it('mirrors a dirty local definition when Korean-only is enabled', async () => { const korean = survey({ onlyForKoreanSpeaker: false, sections: [{ ...survey().sections[0]!, title: localized('한국어 섹션'), items: [{ ...question, question: { ...question.question, prompt: localized('한국어 질문') } }] }] }); const english = { ...korean, locale: 'en', sections: [{ ...korean.sections[0]!, title: localized('English section'), items: [{ ...question, question: { ...question.question, prompt: localized('English question') } }] }] }; api.getAdmin.mockResolvedValueOnce(korean).mockResolvedValueOnce(english); api.replaceDefinition.mockResolvedValue({ survey: korean }); render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>); await screen.findByText('설문 편집'); fireEvent.click(screen.getByLabelText('한국어 사용자 전용')); expect(screen.getByLabelText('Question (English)')).toHaveValue('한국어 질문'); fireEvent.click(screen.getByRole('button', { name: '정의 저장' })); await waitFor(() => expect(api.replaceDefinition).toHaveBeenCalledWith('survey-1', expect.objectContaining({ sections: [expect.objectContaining({ title: { kr: '한국어 섹션', en: '한국어 섹션' }, items: [expect.objectContaining({ question: expect.objectContaining({ prompt: { kr: '한국어 질문', en: '한국어 질문' } }) })] })] }))); });
  it('edits English question fields and choice labels when Korean-only is off', async () => {
    const choiceQuestion = { ...question, question: { ...question.question, type: 'SINGLE_CHOICE' as const, choices: [{ id: 'choice-1', ordinal: 0, value: localized('한국어 선택지') }] } };
    const choiceSurvey = survey({ onlyForKoreanSpeaker: false, sections: [{ ...survey().sections[0]!, items: [choiceQuestion] }] });
    const englishChoiceQuestion = { ...choiceQuestion, question: { ...choiceQuestion.question, prompt: localized('Question English'), choices: [{ id: 'choice-1', ordinal: 0, value: localized('English choice') }] } };
    api.getAdmin.mockResolvedValueOnce(choiceSurvey).mockResolvedValueOnce({ ...choiceSurvey, locale: 'en', title: localized('Survey'), sections: [{ ...choiceSurvey.sections[0]!, title: localized('Section'), items: [englishChoiceQuestion] }] });
    api.imageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' });
    render(<MemoryRouter initialEntries={['/admin/surveys/survey-1/edit']}><Routes><Route path="/admin/surveys/:surveyId/edit" element={<AdminSurveyEditPage/>}/></Routes></MemoryRouter>);
    await screen.findByText('설문 편집');
    const englishPrompt = screen.getByLabelText('Question (English)');
    expect(englishPrompt).not.toHaveAttribute('readonly');
    fireEvent.change(englishPrompt, { target: { value: 'Edited English prompt' } });
    expect(englishPrompt).toHaveValue('Edited English prompt');
    const choice = screen.getByLabelText('Choice 1 English');
    fireEvent.change(choice, { target: { value: 'Edited English choice' } });
    expect(choice).toHaveValue('Edited English choice');
  });
  it('shows Korean-only notice and keeps ordered Korean content in English UI', async () => { api.get.mockResolvedValue(survey({ state: 'OPEN' })); api.publicImageMemberships.mockResolvedValue({ items: [], nextCursor: null, membershipCount: 0, definitionVersion: 1, requestedLocale: 'en', effectiveContentLocale: 'ko' }); render(<MemoryRouter initialEntries={['/surveys/survey-1']}><Routes><Route path="/surveys/:surveyId" element={<EventSurveyPage/>}/></Routes></MemoryRouter>); expect(await screen.findByText('This survey is available in Korean. Korean content is shown below.')).toBeInTheDocument(); expect(screen.getByText('안내')).toBeInTheDocument(); });
  it('advances across membership pages with one ArrowRight and keeps the lightbox contained and accessible', async () => { api.get.mockResolvedValue(survey({ state: 'OPEN' })); api.publicImageMemberships.mockResolvedValueOnce({ items: [{ id: 'm-1', asset: { id: 'a-1', src: '/api/surveys/00000000-0000-4000-8000-000000000000/images/one', contentType: 'image/png', byteSize: 1, width: 1, height: 1 } }], nextCursor: 'next', membershipCount: 2, definitionVersion: 1, requestedLocale: 'en', effectiveContentLocale: 'ko' }).mockResolvedValueOnce({ items: [{ id: 'm-2', asset: { id: 'a-2', src: '/api/surveys/00000000-0000-4000-8000-000000000000/images/two', contentType: 'image/png', byteSize: 1, width: 1, height: 1 } }], nextCursor: null, membershipCount: 2, definitionVersion: 1, requestedLocale: 'en', effectiveContentLocale: 'ko' }); render(<MemoryRouter initialEntries={['/surveys/survey-1']}><Routes><Route path="/surveys/:surveyId" element={<EventSurveyPage/>}/></Routes></MemoryRouter>); const imageButton = await screen.findByRole('button', { name: 'Open image 1' }); fireEvent.keyDown(imageButton, { key: 'ArrowRight' }); await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument()); fireEvent.click(imageButton); expect(screen.getByRole('dialog')).toBeInTheDocument(); const container = screen.getByTestId('lightbox-container'); expect(container).toHaveClass('w-[90vw]', 'h-[90vh]'); expect(container.querySelector('img')).toHaveClass('object-contain'); expect(screen.getByRole('button', { name: 'Close image' })).toHaveFocus(); fireEvent.keyDown(window, { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(imageButton).toHaveFocus(); });
  it('hydrates a submitted response by stable question ID and allows resubmission before the edit deadline', async () => { api.get.mockResolvedValue(survey({ state: 'CLOSED', editDeadlineAt: '2099-01-01T00:00:00.000Z' })); api.session.mockResolvedValue({ authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: 'persisted' }); api.mine.mockResolvedValue({ response: { id: 'response-1', state: 'SUBMITTED', answers: [{ questionId: 'q-1', textValue: 'saved answer' }], submittedAt: '2026-01-01T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: false, maskedPhone: null } }); api.submit.mockResolvedValue({ response: { id: 'response-1', state: 'SUBMITTED', answers: [], submittedAt: '2026-01-01T00:00:00.000Z', reviewedAt: null, reviewReason: null, phonePresent: false, maskedPhone: null } }); render(<MemoryRouter initialEntries={['/surveys/survey-1']}><Routes><Route path="/surveys/:surveyId" element={<EventSurveyPage/>}/></Routes></MemoryRouter>); const input = await screen.findByLabelText('Question'); expect(input).toHaveValue('saved answer'); fireEvent.change(input, { target: { value: 'edited answer' } }); fireEvent.click(screen.getByRole('button', { name: 'Submit' })); await waitFor(() => expect(api.submit).toHaveBeenCalledWith('survey-1', { answers: [{ questionId: 'q-1', textValue: 'edited answer' }] })); });
  it('validates required answers before submitting and sends guest phone only for guests', async () => { const required = { ...question, question: { ...question.question, required: true } }; api.get.mockResolvedValue(survey({ state: 'OPEN', phoneRequired: true, sections: [{ ...survey().sections[0]!, items: [required] }] })); render(<MemoryRouter initialEntries={['/surveys/survey-1']}><Routes><Route path="/surveys/:surveyId" element={<EventSurveyPage/>}/></Routes></MemoryRouter>); await screen.findByRole('button', { name: 'Submit' }); fireEvent.click(screen.getByRole('button', { name: 'Submit' })); await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('required')); expect(api.submit).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText(/^Question/), { target: { value: 'answer' } }); fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '01012345678' } }); api.submit.mockResolvedValue({ status: 'ACCEPTED' }); fireEvent.click(screen.getByRole('button', { name: 'Submit' })); await waitFor(() => expect(api.submit).toHaveBeenCalledWith('survey-1', { answers: [{ questionId: 'q-1', textValue: 'answer' }], guestPhone: '01012345678' })); });
});
