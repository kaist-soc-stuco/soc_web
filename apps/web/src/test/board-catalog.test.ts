import '@testing-library/jest-dom/vitest';

import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn() }));
let auth = { epoch: 1, status: 'ready' as 'ready' | 'unknown', session: { authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: 'persisted' as const } };
const listeners = new Set<() => void>();
vi.mock('@/lib/board-api', () => ({
  BoardApiError: class BoardApiError extends Error { constructor(public status: number) { super(); } },
  boardApi: api,
}));
vi.mock('@/lib/auth-session', () => ({
  getAuthSessionSnapshot: () => auth,
  subscribeAuthSession: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
}));

const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = (code: string, title = code, order = 1) => ({ locale: 'ko', items: [{ id: code, code, title: { value: title, translationUnavailable: false }, description: { value: '', translationUnavailable: false }, config: { isHidden: false, displayOrder: order }, updatedAt: '2026-01-01T00:00:00Z' }] });

beforeEach(() => {
  vi.resetModules();
  api.list.mockReset();
  auth = { epoch: 1, status: 'ready', session: { authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: 'persisted' } };
  listeners.clear();
});
afterEach(cleanup);

describe('board catalog', () => {
  it('deduplicates concurrent requests and a nonterminal invalidation permits exactly one refetch', async () => {
    const first = deferred<ReturnType<typeof response>>();
    api.list.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response('fresh'));
    const catalog = await import('@/lib/board-catalog');
    const one = catalog.loadBoardCatalog();
    expect(catalog.loadBoardCatalog()).toBe(one);
    first.resolve(response('old'));
    await expect(one).resolves.toEqual([{ code: 'old', title: 'old' }]);
    catalog.invalidateBoardCatalog();
    await expect(Promise.all([catalog.loadBoardCatalog(), catalog.loadBoardCatalog()])).resolves.toEqual([[{ code: 'fresh', title: 'fresh' }], [{ code: 'fresh', title: 'fresh' }]]);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('preserves the public API response order', async () => {
    const first = response('first', '첫째', 20).items[0];
    const second = response('second', '둘째', 10).items[0];
    api.list.mockResolvedValueOnce({ locale: 'ko', items: [first, second] });
    const catalog = await import('@/lib/board-catalog');

    await expect(catalog.loadBoardCatalog()).resolves.toEqual([
      { code: 'first', title: '첫째' },
      { code: 'second', title: '둘째' },
    ]);
  });

  it('makes a 401 terminal for its auth epoch, clears cache, and recovers once for a newer epoch', async () => {
    const { BoardApiError } = await import('@/lib/board-api');
    api.list.mockRejectedValueOnce(new BoardApiError(401)).mockResolvedValueOnce(response('recovered'));
    const catalog = await import('@/lib/board-catalog');
    await expect(catalog.loadBoardCatalog()).rejects.toMatchObject({ status: 401 });
    await expect(catalog.loadBoardCatalog()).rejects.toMatchObject({ status: 401 });
    expect(api.list).toHaveBeenCalledTimes(1);
    auth = { ...auth, epoch: 2 };
    listeners.forEach((listener) => listener());
    await expect(catalog.loadBoardCatalog()).resolves.toEqual([{ code: 'recovered', title: 'recovered' }]);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('fences a stale prior-epoch fulfillment and finally cleanup from the current request', async () => {
    const stale = deferred<ReturnType<typeof response>>();
    const currentResponse = deferred<ReturnType<typeof response>>();
    api.list.mockReturnValueOnce(stale.promise).mockReturnValueOnce(currentResponse.promise);
    const catalog = await import('@/lib/board-catalog');
    const old = catalog.loadBoardCatalog();
    auth = { ...auth, epoch: 2 };
    listeners.forEach((listener) => listener());
    const current = catalog.loadBoardCatalog();
    stale.resolve(response('stale'));
    await expect(old).resolves.toEqual([{ code: 'stale', title: 'stale' }]);
    expect(catalog.loadBoardCatalog()).toBe(current);
    currentResponse.resolve(response('current'));
    await expect(current).resolves.toEqual([{ code: 'current', title: 'current' }]);
  });
  it('clears every renderable item after a terminal 401 and does not retry on a same-epoch remount', async () => {
    const { BoardApiError } = await import('@/lib/board-api');
    api.list.mockResolvedValueOnce(response('visible')).mockRejectedValueOnce(new BoardApiError(401));
    const catalog = await import('@/lib/board-catalog');
    const Catalog = () => {
      const current = catalog.useBoardCatalog();
      return createElement(
        'div',
        undefined,
        ...current.items.map((item) => createElement('a', { key: item.code, href: `/board/${item.code}` }, item.title)),
        createElement('output', undefined, current.status),
      );
    };

    const view = render(createElement(Catalog));
    await screen.findByRole('link', { name: 'visible' });
    catalog.invalidateBoardCatalog();
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'visible' })).not.toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2);

    view.unmount();
    render(createElement(Catalog));
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('does not expose a previously ready catalog after a non-401 failure', async () => {
    api.list.mockResolvedValueOnce(response('visible')).mockRejectedValueOnce(new Error('offline'));
    const catalog = await import('@/lib/board-catalog');
    const Catalog = () => {
      const current = catalog.useBoardCatalog();
      return createElement('div', undefined, ...current.items.map((item) => createElement('a', { key: item.code }, item.title)), createElement('output', undefined, current.status));
    };

    render(createElement(Catalog));
    await screen.findByText('visible');
    catalog.invalidateBoardCatalog();
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
    expect(screen.queryByText('visible')).not.toBeInTheDocument();
  });

  it('clears for a credential transition before confirmation and ignores its old catalog response', async () => {
    const stale = deferred<ReturnType<typeof response>>();
    api.list.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(response('confirmed'));
    const catalog = await import('@/lib/board-catalog');
    const old = catalog.loadBoardCatalog();

    auth = { ...auth, epoch: 2, status: 'unknown' };
    listeners.forEach((listener) => listener());
    expect(await catalog.loadBoardCatalog()).toEqual([]);
    stale.resolve(response('stale'));
    await expect(old).resolves.toEqual([{ code: 'stale', title: 'stale' }]);

    auth = { ...auth, status: 'ready' };
    listeners.forEach((listener) => listener());
    await expect(catalog.loadBoardCatalog()).resolves.toEqual([{ code: 'confirmed', title: 'confirmed' }]);
  });
  it('fences a stale prior-epoch rejection and finally cleanup from the current request', async () => {
    const stale = deferred<ReturnType<typeof response>>();
    const currentResponse = deferred<ReturnType<typeof response>>();
    api.list.mockReturnValueOnce(stale.promise).mockReturnValueOnce(currentResponse.promise);
    const catalog = await import('@/lib/board-catalog');
    const old = catalog.loadBoardCatalog();
    auth = { ...auth, epoch: 2 };
    listeners.forEach((listener) => listener());
    const current = catalog.loadBoardCatalog();
    stale.reject(new Error('prior actor offline'));
    await expect(old).rejects.toThrow('prior actor offline');
    expect(catalog.loadBoardCatalog()).toBe(current);
    currentResponse.resolve(response('current'));
    await expect(current).resolves.toEqual([{ code: 'current', title: 'current' }]);
  });

  it('performs one deduplicated refetch across transition and same-epoch confirmation', async () => {
    const initial = deferred<ReturnType<typeof response>>();
    api.list.mockReturnValueOnce(initial.promise).mockResolvedValueOnce(response('confirmed'));
    const catalog = await import('@/lib/board-catalog');
    const old = catalog.loadBoardCatalog();

    auth = { ...auth, epoch: 2, status: 'unknown' };
    listeners.forEach((listener) => listener());
    auth = { ...auth, status: 'ready' };
    listeners.forEach((listener) => listener());

    const confirmed = catalog.loadBoardCatalog();
    expect(catalog.loadBoardCatalog()).toBe(confirmed);
    initial.resolve(response('prior'));
    await expect(old).resolves.toEqual([{ code: 'prior', title: 'prior' }]);
    await expect(confirmed).resolves.toEqual([{ code: 'confirmed', title: 'confirmed' }]);
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});
