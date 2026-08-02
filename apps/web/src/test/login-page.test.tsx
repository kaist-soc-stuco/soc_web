import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const snapshot = { epoch: 0 };
  return {
    apiClient: {
      getSession: vi.fn(),
      submitConsentDecision: vi.fn(),
      logout: vi.fn(),
      loginWithDevelopmentAccount: vi.fn(),
    },
    beginAuthSessionTransition: vi.fn(() => { snapshot.epoch += 1; }),
    getAuthSessionSummary: vi.fn(),
    loadBoardCatalog: vi.fn(),
    refetchAdminGrants: vi.fn(),
    invalidateAdminGrants: vi.fn(),
    setAuthSession: vi.fn(),
    snapshot,
  };
});

vi.mock('@soc/api-client', () => ({ createApiClient: vi.fn(() => mocks.apiClient) }));
vi.mock('@/lib/auth-session', () => ({
  beginAuthSessionTransition: mocks.beginAuthSessionTransition,
  createEmptyAuthSession: vi.fn(() => ({ authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null })),
  getAuthSessionSnapshot: vi.fn(() => mocks.snapshot),
  getAuthSessionSummary: mocks.getAuthSessionSummary,
  setAuthSession: mocks.setAuthSession,
}));
vi.mock('@/lib/board-catalog', () => ({ loadBoardCatalog: mocks.loadBoardCatalog }));
vi.mock('@/lib/admin-grants', () => ({
  invalidateAdminGrants: mocks.invalidateAdminGrants,
  refetchAdminGrants: mocks.refetchAdminGrants,
}));

import { LoginConsentPage } from '@/pages/login-consent-page';
import { TreeLogin } from '@/pages/login-page';

const authenticatedSession = {
  authenticated: true,
  canUsePersistentFeatures: true,
  requiresConsent: false,
  storageMode: 'persisted' as const,
  userId: 'user-1',
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.snapshot.epoch = 0;
  mocks.apiClient.submitConsentDecision.mockResolvedValue(undefined);
  mocks.apiClient.logout.mockResolvedValue(undefined);
  mocks.apiClient.loginWithDevelopmentAccount.mockResolvedValue(undefined);
  mocks.getAuthSessionSummary.mockResolvedValue(authenticatedSession);
  mocks.loadBoardCatalog.mockResolvedValue(undefined);
  mocks.refetchAdminGrants.mockResolvedValue(undefined);
});

describe('consent completion', () => {
  it('keeps the confirmed consent transition as the only credential epoch change after returning to login', async () => {
    render(
      <MemoryRouter initialEntries={['/login/consent']}>
        <Routes>
          <Route path="/login/consent" element={<LoginConsentPage />} />
          <Route path="/login" element={<TreeLogin />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '동의하고 저장' }));

    await waitFor(() => expect(mocks.apiClient.submitConsentDecision).toHaveBeenCalledWith({ consent: true }));
    await waitFor(() => expect(screen.getByText('로그인이 완료되었습니다.')).toBeVisible());

    expect(mocks.beginAuthSessionTransition).toHaveBeenCalledTimes(1);
    expect(mocks.snapshot.epoch).toBe(1);
    expect(mocks.loadBoardCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.refetchAdminGrants).toHaveBeenCalledTimes(1);
    expect(mocks.getAuthSessionSummary).toHaveBeenCalled();
  });

  it('advances one credential epoch before publishing an already-anonymous successful logout', async () => {
    mocks.getAuthSessionSummary.mockResolvedValue({
      authenticated: false,
      canUsePersistentFeatures: false,
      requiresConsent: false,
      storageMode: null,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<TreeLogin />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(mocks.apiClient.logout).toHaveBeenCalledTimes(1));
    expect(mocks.beginAuthSessionTransition).toHaveBeenCalledTimes(1);
    expect(mocks.snapshot.epoch).toBe(1);
    expect(mocks.setAuthSession).toHaveBeenCalledTimes(1);
    expect(mocks.loadBoardCatalog).toHaveBeenCalledTimes(1);
  });

  it('offers three fixed development identities and logs in with the selected account', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<TreeLogin />} />
          <Route path="/" element={<p>홈</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '관리자 계정' })).toBeVisible();
    expect(screen.getByRole('button', { name: '일반 사용자 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: '일반 사용자 2' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '일반 사용자 2' }));

    await waitFor(() => expect(mocks.apiClient.loginWithDevelopmentAccount).toHaveBeenCalledWith('user-2'));
    expect(await screen.findByText('홈')).toBeVisible();
  });
});
