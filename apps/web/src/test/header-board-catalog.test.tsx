import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const catalog = vi.hoisted(() => ({ current: { status: 'idle' as 'idle' | 'loading' | 'ready' | 'error', items: [] as readonly { code: string; title: string }[], error: undefined as unknown }, load: vi.fn(), invalidate: vi.fn() }));
const auth = vi.hoisted(() => ({ authenticated: false, logout: vi.fn() }));
vi.mock('@/lib/board-catalog', () => ({ useBoardCatalog: () => catalog.current, loadBoardCatalog: catalog.load, invalidateBoardCatalog: catalog.invalidate }));
vi.mock('@/lib/auth-session', () => ({ getAuthSessionSnapshot: vi.fn(() => ({ epoch: 1 })), getAuthSessionSummary: vi.fn(() => Promise.resolve({ authenticated: auth.authenticated })) }));
vi.mock('@soc/api-client', () => ({ createApiClient: vi.fn(() => ({ logout: auth.logout })) }));
vi.mock('@/components/atoms/logo', () => ({ Logo: () => <span>logo</span> }));
vi.mock('@/lib/admin-grants', () => ({ useAdminGrants: () => ({ status: 'ready', grants: ['admin'] }), invalidateAdminGrants: vi.fn() }));
vi.mock('@/lib/static-site-content', () => ({ visibleAdminMenu: () => [{ to: '/admin' }] }));

import { Header } from '@/components/organisms/header';
import { setLocale } from '@/lib/locale-store';

const renderHeader = () => render(<MemoryRouter><Header /></MemoryRouter>);

afterEach(cleanup);
beforeEach(() => {
  catalog.current = { status: 'idle', items: [], error: undefined };
  catalog.load.mockReset();
  catalog.invalidate.mockReset();
  auth.authenticated = false;
  auth.logout.mockReset();
  setLocale('ko');
});

describe('Header board catalog navigation', () => {
  it('renders board links only from a ready catalog', () => {
    catalog.current = { status: 'ready', items: [{ code: 'notice', title: '공지' }], error: undefined };
    renderHeader();
    fireEvent.mouseEnter(screen.getByRole('link', { name: '게시판' }).parentElement!);
    expect(screen.getByRole('link', { name: '공지' })).toHaveAttribute('href', '/board/notice');
  });

  it('uses the board hub for top-level navigation', () => {
    catalog.current = { status: 'ready', items: [{ code: 'notice', title: '공지' }], error: undefined };
    renderHeader();
    expect(screen.getByRole('link', { name: '게시판' })).toHaveAttribute('href', '/board');
  });

  it.each([
    ['loading', '게시판 정보를 불러오는 중입니다.'],
    ['error', '게시판 정보를 불러오지 못했습니다.'],
    ['ready', '표시할 게시판이 없습니다.'],
  ] as const)('announces the %s catalog state accessibly without stale board links', (status, announcement) => {
    catalog.current = { status, items: status === 'error' ? [{ code: 'stale', title: '오래된 게시판' }] : [], error: status === 'error' ? new Error('offline') : undefined };
    renderHeader();
    expect(screen.getByText(announcement)).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('link', { name: '오래된 게시판' })).not.toBeInTheDocument();
  });

  it('offers an accessible retry only for catalog errors', () => {
    catalog.current = { status: 'error', items: [], error: new Error('offline') };
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: '게시판 다시 불러오기' }));
    expect(catalog.load).toHaveBeenCalledTimes(1);
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
  });

  it('reports logout failures without discarding the authenticated session', async () => {
    auth.authenticated = true;
    auth.logout.mockRejectedValue(new Error('offline'));
    renderHeader();
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다.');
    await waitFor(() => expect(screen.getByRole('link', { name: '마이페이지' })).toBeVisible());
  });

  it('localizes unauthenticated and mobile navigation in English', async () => {
    setLocale('en');
    renderHeader();

    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('navigation', { name: 'Mobile menu' })).toBeVisible();
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('localizes authenticated navigation, loading, and errors in English', async () => {
    auth.authenticated = true;
    let rejectLogout!: (reason: unknown) => void;
    auth.logout.mockReturnValue(new Promise((_, reject) => { rejectLogout = reject; }));
    setLocale('en');
    renderHeader();

    expect(await screen.findByRole('link', { name: 'My Page' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Admin Center' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getAllByRole('link', { name: 'My Page' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Admin Center' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]);
    expect(await screen.findAllByRole('button', { name: 'Logging out' })).toHaveLength(2);
    rejectLogout(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log out.');
    expect(screen.queryByText('로그아웃하지 못했습니다.', { exact: false })).not.toBeInTheDocument();
  });
});
