import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { getMock, updateMock } = vi.hoisted(() => ({ getMock: vi.fn(), updateMock: vi.fn() }));
vi.mock('@/lib/profile-api', () => ({
  profileApi: { get: getMock, update: updateMock },
  ProfileApiError: class ProfileApiError extends Error { constructor(public status: number) { super(); } },
}));
vi.mock('@/lib/board-catalog', () => ({ useBoardCatalog: () => ({ status: 'ready', items: [] }), loadBoardCatalog: vi.fn(), invalidateBoardCatalog: vi.fn() }));

import { MyPage } from '@/pages/mypage-page';

const profile = {
  feeStatus: 'PAID' as const,
  id: 'user-1', kaistUid: 'uid', studentOrEmployeeNumber: '20260001', nameKr: '홍길동', nameEn: 'Gil Dong Hong', majorMask: 1,
  privacyConsentAt: '2026-01-01T00:00:00.000Z', userEmail: 'old@example.com', userMobile: '010-0000-0000', grants: [],
};

beforeEach(() => { getMock.mockReset(); updateMock.mockReset(); });
afterEach(cleanup);

describe('mypage', () => {
  it('shows the signed-in user profile and fee status', async () => {
    getMock.mockResolvedValue(profile);
    render(<MemoryRouter><MyPage /></MemoryRouter>);
    expect(await screen.findByText('홍길동')).toBeTruthy();
    expect(screen.getByText('납부 완료')).toBeTruthy();
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('old@example.com');
  });

  it('updates only editable contact details', async () => {
    getMock.mockResolvedValue(profile);
    updateMock.mockResolvedValue({ ...profile, userEmail: 'new@example.com', userMobile: null });
    render(<MemoryRouter><MyPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('이메일'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('전화번호'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('연락처를 저장했습니다.')).toBeTruthy();
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ userEmail: 'new@example.com', userMobile: null }));
  });

  it('shows a safe load error', async () => {
    getMock.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><MyPage /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('내 정보를 불러오지 못했습니다.');
  });
});
