import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AdminSurveyAggregate, AdminSurveyResponseDetail, AdminSurveyResponsePage } from '@soc/contracts';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSurveyOperationsPage } from '@/pages/admin-survey-operations-page';
import { setLocale } from '@/lib/locale-store';

const api = vi.hoisted(() => ({ aggregate: vi.fn(), export: vi.fn(), get: vi.fn(), materializeEvent: vi.fn(), response: vi.fn(), responses: vi.fn(), review: vi.fn() }));
const grants = vi.hoisted(() => ({ current: [{ scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_MANAGE' }, { scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_REVIEW' }] }));
vi.mock('@/lib/survey-api', () => ({ surveyApi: api }));
vi.mock('@/lib/admin-grants', () => ({ useAdminGrants: () => ({ status: 'ready', grants: grants.current }) }));

const localized = (value: string) => ({ value, translationUnavailable: false });
const page = (items: AdminSurveyResponsePage['items'] = [], overrides: Partial<AdminSurveyResponsePage> = {}): AdminSurveyResponsePage => ({ surveyId: 'survey-1', locale: 'ko', state: 'SUBMITTED', limit: 25, matchingCount: items.length, items, nextCursor: null, ...overrides });
const item = (responseId = 'response-1') => ({ responseId, surveyId: 'survey-1', surveyRevisionId: 'revision-1', revision: 1, state: 'SUBMITTED' as const, submittedAt: '2026-08-01T00:00:00.000Z', reviewedAt: null });
const detail = (responseId = 'response-1'): AdminSurveyResponseDetail => ({ responseId, surveyId: 'survey-1', surveyRevisionId: 'revision-1', revision: 1, locale: 'ko', state: 'SUBMITTED', submittedAt: '2026-08-01T00:00:00.000Z', reviewedAt: null, reviewReason: null, answers: [{ questionId: 'q-1', prompt: localized('현지화된 질문'), value: { kind: 'choices', choices: [{ choiceOptionId: 'c-1', label: localized('현지화된 선택지') }] } }] });
const aggregate = (): AdminSurveyAggregate => ({ surveyId: 'survey-1', locale: 'ko', surveySuppressed: false, revisions: [{ surveyRevisionId: 'revision-1', revision: 1, suppressed: false, responseCount: 1, questions: [{ questionId: 'q-1', prompt: localized('집계 질문'), responseCount: 1, choices: [{ choiceOptionId: 'c-1', label: localized('집계 선택지'), count: 1 }] }] }] });

function Location() { return <output data-testid="location">{useLocation().search}</output>; }
function renderPage(entry = '/admin/surveys/survey-1/responses?state=SUBMITTED') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/surveys/:surveyId/responses" element={<><AdminSurveyOperationsPage /><Location /></>} /></Routes></MemoryRouter>);
}

beforeEach(() => { grants.current = [{ scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_MANAGE' }, { scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_REVIEW' }]; api.responses.mockResolvedValue(page([item()])); api.aggregate.mockResolvedValue(aggregate()); api.response.mockResolvedValue(detail()); api.get.mockResolvedValue({ id: 'survey-1', locale: 'ko', title: localized('설문'), opensAt: '2026-08-01T00:00:00.000Z', closesAt: '2026-08-02T00:00:00.000Z' }); });
afterEach(() => { setLocale('ko'); cleanup(); Object.values(api).forEach((mock) => mock.mockReset()); });

describe('AdminSurveyOperationsPage', () => {
  it('renders loading safely, empty data, independent errors and retries', async () => {
    api.responses.mockRejectedValueOnce(new Error('page failed')).mockResolvedValueOnce(page([]));
    api.aggregate.mockRejectedValueOnce(new Error('aggregate failed')).mockResolvedValueOnce(aggregate());
    renderPage();
    expect(screen.getByRole('heading', { name: /응답/ })).toBeVisible();
    await screen.findAllByRole('alert');
    expect(screen.getAllByRole('button', { name: '다시 시도' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: '다시 시도' })[0]);
    await waitFor(() => expect(api.responses).toHaveBeenCalledTimes(2));
    expect(api.aggregate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(api.aggregate).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('clears old response rows before filter and cursor replacements can open them', async () => {
    const pendingPages: Array<(value: AdminSurveyResponsePage) => void> = [];
    api.responses.mockImplementation((_surveyId, query) => {
      if (query.state === 'SUBMITTED' && !query.cursor) return Promise.resolve(page([item('response-1')], { nextCursor: 'next-token' }));
      return new Promise<AdminSurveyResponsePage>((resolve) => { pendingPages.push(resolve); });
    });
    renderPage();
    await screen.findByRole('button', { name: '열기' });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'APPROVED' } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('state=APPROVED'));
    expect(screen.queryByRole('button', { name: '열기' })).not.toBeInTheDocument();
    expect(api.response).not.toHaveBeenCalled();

    pendingPages.shift()!(page([item('response-2')], { state: 'APPROVED', nextCursor: 'next-token' }));
    await screen.findByRole('button', { name: '열기' });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('state=APPROVED&cursor=next-token'));
    expect(screen.queryByRole('button', { name: '열기' })).not.toBeInTheDocument();
    expect(api.response).not.toHaveBeenCalled();
  });

  it.each([[0, false], [1, true], [500, true], [501, false]] as const)('validates rejection reason length %i', async (length, enabled) => {
    renderPage();
    await screen.findByRole('button', { name: '열기' });
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await screen.findByText('현지화된 질문');
    fireEvent.change(screen.getByRole('textbox', { name: '거절 사유' }), { target: { value: 'x'.repeat(length) } });
    expect(screen.getByRole('button', { name: '반려' })).toHaveProperty('disabled', !enabled);
  });

  it('cancels then confirms review with the exact response tuple, and only managers can materialize PUBLIC events', async () => {
    api.review.mockResolvedValue({ ...detail(), state: 'REJECTED', reviewReason: '사유' });
    api.materializeEvent.mockResolvedValue({ eventId: 'event-1', relation: { id: 'relation-1', kind: 'SURVEY_EVENT', surveyId: 'survey-1', eventId: 'event-1' } });
    renderPage();
    await screen.findByRole('button', { name: '열기' });
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await screen.findByText('현지화된 질문');
    fireEvent.change(screen.getByRole('textbox', { name: '거절 사유' }), { target: { value: ' 사유 ' } });
    fireEvent.click(screen.getByRole('button', { name: '반려' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(api.review).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '반려' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('survey-1', 'response-1', 'ko', { expectedSurveyRevisionId: 'revision-1', state: 'REJECTED', reason: '사유' }));
    expect(screen.getByRole('heading', { name: '공개 행사 만들기' })).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: '장소' }), { target: { value: ' N1 ' } });
    fireEvent.click(screen.getByRole('button', { name: '공개 행사 만들기' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(api.materializeEvent).toHaveBeenCalledWith('survey-1', { location: 'N1', visibility: 'PUBLIC' }));
    expect(screen.getByRole('link', { name: '행사 열기' })).toHaveAttribute('href', '/events/event-1');
  });
  it.each([
    ['승인', 'APPROVED', '사유 없음'],
    ['대기', 'WAITLISTED', '사유 없음'],
    ['반려', 'REJECTED', '검토 사유'],
  ] as const)('identifies the response revision and consequence before %s review', async (button, state, reason) => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '열기' }));
    await screen.findByRole('heading', { name: '응답 상세' });
    if (state === 'REJECTED') fireEvent.change(screen.getByRole('textbox', { name: '거절 사유' }), { target: { value: reason } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(`응답 response-1, 개정 1`);
    expect(dialog).toHaveTextContent(`이 응답은 ${button} 상태가 됩니다. 사유: ${reason}`);
  });
  it('discloses that PUBLIC materialization is visible to everyone before confirmation', async () => {
    renderPage();
    await screen.findByRole('heading', { name: '공개 행사 만들기' });
    fireEvent.change(screen.getByRole('textbox', { name: '장소' }), { target: { value: 'N1' } });
    fireEvent.click(screen.getByRole('button', { name: '공개 행사 만들기' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('PUBLIC으로 생성되어 누구나 볼 수 있습니다.');
  });
  it('localizes protocol mismatches after a runtime locale switch', async () => {
    api.responses.mockResolvedValueOnce(page([item()], { locale: 'en' })).mockResolvedValueOnce(page([item()], { locale: 'ko' }));
    api.aggregate.mockResolvedValueOnce(aggregate()).mockResolvedValueOnce({ ...aggregate(), locale: 'en' });
    api.get.mockResolvedValueOnce({ id: 'survey-1', locale: 'ko', title: localized('설문'), opensAt: null, closesAt: null }).mockResolvedValueOnce({ id: 'survey-1', locale: 'en', title: localized('Survey'), opensAt: null, closesAt: null });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('서버 응답이 요청과 일치하지 않습니다.');
    setLocale('en');
    await waitFor(() => expect(api.responses).toHaveBeenLastCalledWith('survey-1', expect.objectContaining({ locale: 'en' }), expect.any(AbortSignal)));
    expect(await screen.findByRole('alert')).toHaveTextContent('The server response does not match the request.');
  });
  it('keeps representative interactive controls touch-sized and narrow-screen safe', async () => {
    renderPage();
    const filter = await screen.findByRole('combobox');
    expect(filter).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'CSV 내보내기' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '열기' })).toHaveClass('min-h-11');
    expect(filter.closest('section')).toContainHTML('overflow-x-auto');
  });

  it('hides materialization without global manage permission and never renders sensitive response fields', async () => {
    grants.current = [{ scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_REVIEW' }];
    renderPage();
    await screen.findByRole('button', { name: '열기' });
    expect(screen.queryByRole('heading', { name: '공개 행사 만들기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/phone|hash|ciphertext|reviewer/i)).not.toBeInTheDocument();
  });
  it('keeps the response page while decoder mismatches clear the selected detail and allow a scoped retry', async () => {
    api.response.mockResolvedValueOnce({ ...detail(), locale: 'en' }).mockResolvedValueOnce(detail());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '열기' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('서버 응답이 요청과 일치하지 않습니다.');
    expect(alert).toHaveFocus();
    expect(screen.queryByRole('heading', { name: '응답 상세' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('heading', { name: '응답 상세' })).toBeVisible();
  });

  it('clears a successful review target and focuses the localized outcome status', async () => {
    api.review.mockResolvedValue({ ...detail(), state: 'APPROVED' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '열기' }));
    await screen.findByText('현지화된 질문');
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '확인' }));
    const outcome = await screen.findByText('승인', { selector: 'p[role="status"]' });
    await waitFor(() => expect(api.review).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: '응답 상세' })).not.toBeInTheDocument();
    expect(outcome).toHaveTextContent('승인');
    expect(outcome).toHaveFocus();
  });

  it('resets invalid cursor errors and terminal cursors to the first filter page', async () => {
    api.responses.mockRejectedValueOnce(new Error('bad cursor')).mockResolvedValue(page([]));
    renderPage('/admin/surveys/survey-1/responses?state=REJECTED&cursor=invalid');
    fireEvent.click(await screen.findByRole('button', { name: '초기화' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('state=SUBMITTED'));

    cleanup();
    api.responses.mockResolvedValue(page([], { state: 'APPROVED' }));
    renderPage('/admin/surveys/survey-1/responses?state=APPROVED&cursor=terminal');
    await waitFor(() => expect(api.responses).toHaveBeenLastCalledWith('survey-1', expect.objectContaining({ state: 'APPROVED', cursor: 'terminal', locale: 'ko' }), expect.any(AbortSignal)));
    fireEvent.click(await screen.findByRole('button', { name: '처음으로' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('state=SUBMITTED'));
  });

  it('allows manage-only users to materialize without loading review resources', async () => {
    grants.current = [{ scope: 'GLOBAL', scopeId: null, permission: 'SURVEY_MANAGE' }];
    renderPage();
    expect(await screen.findByRole('heading', { name: '공개 행사 만들기' })).toBeVisible();
    expect(api.responses).not.toHaveBeenCalled();
    expect(api.aggregate).not.toHaveBeenCalled();
  });
});
