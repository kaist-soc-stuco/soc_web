import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AdminPledge, Pledge } from '@soc/contracts';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn(), adminList: vi.fn(), create: vi.fn(), patch: vi.fn(), remove: vi.fn() }));
const voteApi = vi.hoisted(() => ({ adminList: vi.fn(), create: vi.fn(), patch: vi.fn(), transition: vi.fn(), importVoterRoll: vi.fn() }));
vi.mock('@/components/organisms/header', () => ({ Header: () => <header aria-label="site header" /> }));
vi.mock('@/lib/governance-api', () => ({
  pledgeApi: api,
  voteApi,
  GovernanceApiError: class GovernanceApiError extends Error {
    constructor(public readonly status: number, public readonly code?: string) { super(code ?? 'HTTP ' + status); }
  },
}));
vi.mock('@/lib/locale-store', () => ({ useLocale: () => ['ko', vi.fn()] as const }));

import { AdminPledgesPage } from '@/pages/admin-pledges-page';
import { AdminVotesPage } from '@/pages/admin-votes-page';
import { PledgesPage } from '@/pages/pledges-page';

const localized = (value: string) => ({ value, translationUnavailable: false });
const pledge = (overrides: Partial<Pledge> = {}): Pledge => ({
  id: 'pledge-1',
  ordinal: 0,
  title: localized('수업·학사 정보 개선'),
  description: localized('학사 정보를 한 곳에서 찾기 쉽게 정리합니다.'),
  status: 'IN_PROGRESS',
  progressPercent: 75,
  progress: localized('학사 캘린더와 공지 연결을 점검하고 있습니다.'),
  targetDate: '2026-09-30',
  ...overrides,
});
const adminPledge = (overrides: Partial<AdminPledge> = {}): AdminPledge => ({
  id: 'pledge-1',
  ordinal: 0,
  titleKr: '수업·학사 정보 개선',
  titleEn: 'Academic information',
  descriptionKr: '학사 정보를 한 곳에서 찾기 쉽게 정리합니다.',
  descriptionEn: 'Make academic information easier to find.',
  status: 'IN_PROGRESS',
  progressPercent: 75,
  progressKr: '학사 캘린더와 공지 연결을 점검하고 있습니다.',
  progressEn: 'Checking the calendar and notice connection.',
  targetDate: '2026-09-30',
  isPublished: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('governance pages', () => {
  it('uses accessible buttons for pledge expansion and exposes progress semantics', async () => {
    api.list.mockResolvedValue({ locale: 'ko', items: [pledge(), pledge({ id: 'pledge-2', ordinal: 1, title: localized('학생 의견 수렴 강화'), description: localized('학생 의견을 정기적으로 수렴합니다.'), progressPercent: 55 })] });
    render(<MemoryRouter><PledgesPage /></MemoryRouter>);

    const first = await screen.findByRole('button', { name: /수업·학사 정보 개선/ });
    const second = screen.getByRole('button', { name: /학생 의견 수렴 강화/ });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('학사 정보를 한 곳에서 찾기 쉽게 정리합니다.').length).toBeGreaterThan(1);
    expect(screen.getByRole('progressbar', { name: '수업·학사 정보 개선 진행률' })).toHaveAttribute('aria-valuenow', '75');

    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('pledge-details-pledge-1')).not.toBeInTheDocument();
  });

  it('renders public empty and error states without stale pledge rows', async () => {
    api.list.mockResolvedValueOnce({ locale: 'ko', items: [] });
    render(<MemoryRouter><PledgesPage /></MemoryRouter>);
    expect(await screen.findByText('공개된 공약이 없습니다.')).toBeVisible();
    cleanup();

    api.list.mockRejectedValueOnce(new Error('unavailable'));
    render(<MemoryRouter><PledgesPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('공약 현황을 불러오지 못했습니다.');
    expect(screen.queryByText('수업·학사 정보 개선')).not.toBeInTheDocument();
  });

  it('persists range changes from keyboard and keeps admin fields individually addressable', async () => {
    const current = adminPledge();
    api.adminList.mockResolvedValue({ items: [current] });
    api.patch.mockImplementation(async (_id: string, input: Partial<AdminPledge>) => ({ ...current, ...input }));
    render(<AdminPledgesPage />);

    const slider = await screen.findByRole('slider', { name: '수업·학사 정보 개선 진척도' });
    fireEvent.change(slider, { target: { value: '80' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('pledge-1', { progressPercent: 80 }));

    const status = screen.getByRole('combobox', { name: '수업·학사 정보 개선 상태' });
    fireEvent.change(status, { target: { value: 'DONE' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('pledge-1', { status: 'DONE' }));

    const progress = screen.getByRole('textbox', { name: '수업·학사 정보 개선 이행 상황 (한국어)' });
    fireEvent.change(progress, { target: { value: '완료했습니다.' } });
    fireEvent.blur(progress);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('pledge-1', { progressKr: '완료했습니다.' }));
  });

  it('creates and deletes pledges from the administrator form', async () => {
    api.adminList.mockResolvedValue({ items: [] });
    api.create.mockResolvedValue(adminPledge({ id: 'pledge-new', ordinal: 0, titleKr: '새 공약' }));
    api.remove.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminPledgesPage />);

    fireEvent.change(await screen.findByLabelText('새 공약 제목 (한국어)'), { target: { value: '새 공약' } });
    fireEvent.change(screen.getByLabelText('새 공약 제목 (English)'), { target: { value: 'New pledge' } });
    fireEvent.change(screen.getByLabelText('새 공약 설명 (한국어)'), { target: { value: '설명' } });
    fireEvent.change(screen.getByLabelText('새 공약 설명 (English)'), { target: { value: 'Description' } });
    fireEvent.change(screen.getByLabelText('새 공약 이행 상황 (한국어)'), { target: { value: '준비 중' } });
    fireEvent.change(screen.getByLabelText('새 공약 이행 상황 (English)'), { target: { value: 'Planned' } });
    fireEvent.click(screen.getByRole('button', { name: '공약 추가' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ titleKr: '새 공약', titleEn: 'New pledge', progressKr: '준비 중', progressEn: 'Planned' })));
    fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('pledge-new'));
    confirmSpy.mockRestore();
  });

  it('reports incomplete vote forms and rejects malformed voter-roll files before upload', async () => {
    voteApi.adminList.mockResolvedValue({ items: [{ id: 'vote-1', titleKr: '기존 투표', state: 'DRAFT', eligibleVoterCount: 0, turnoutPercent: 0, candidates: [] }] });
    render(<AdminVotesPage />);
    await screen.findByRole('heading', { name: '투표 관리' });

    expect(screen.getByRole('button', { name: '개설' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('선거인 명부');

    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('한국어/영어 제목과 후보명을 입력하세요.');
    expect(voteApi.create).not.toHaveBeenCalled();

    const file = new File(['BAD_KIND,20260001'], 'voters.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('기존 투표 선거인 명부 CSV/TSV'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('선거인 명부 형식이 올바르지 않습니다.'));
    expect(voteApi.importVoterRoll).not.toHaveBeenCalled();
  });

  it('creates a valid two-candidate vote with normalized form values', async () => {
    voteApi.adminList.mockResolvedValue({ items: [] });
    voteApi.create.mockResolvedValue({ id: 'vote-1', titleKr: '새 투표', state: 'DRAFT', eligibleVoterCount: 0, turnoutPercent: 0, candidates: [] });
    render(<AdminVotesPage />);
    await screen.findByRole('heading', { name: '투표 관리' });

    fireEvent.change(screen.getByLabelText('제목 (한국어)'), { target: { value: ' 새 투표 ' } });
    fireEvent.change(screen.getByLabelText('제목 (English)'), { target: { value: ' New vote ' } });
    fireEvent.change(screen.getByLabelText('후보 1'), { target: { value: ' 후보 A ' } });
    fireEvent.change(screen.getByLabelText('후보 2'), { target: { value: ' 후보 B ' } });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    await waitFor(() => expect(voteApi.create).toHaveBeenCalledWith(expect.objectContaining({
      titleKr: '새 투표',
      titleEn: 'New vote',
      candidates: [{ nameKr: '후보 A', nameEn: '후보 A' }, { nameKr: '후보 B', nameEn: '후보 B' }],
    })));
  });
});
