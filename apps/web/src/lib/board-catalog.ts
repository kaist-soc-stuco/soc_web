import { useEffect, useSyncExternalStore } from 'react';
import type { Board } from '@soc/contracts';
import { BoardApiError, boardApi } from './board-api';
import { getAuthSessionSnapshot, subscribeAuthSession } from './auth-session';

export interface BoardCatalogItem {
  readonly code: string;
  readonly title: string;
}

export interface BoardCatalogSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly items: readonly BoardCatalogItem[];
  readonly error?: unknown;
}

let snapshot: BoardCatalogSnapshot = { status: 'idle', items: [] };
let lastGood: readonly BoardCatalogItem[] = [];
let generation = 0;
let authEpoch = getAuthSessionSnapshot().epoch;
let terminalEpoch: number | undefined;
let pending: Promise<readonly BoardCatalogItem[]> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;

const clearForAuthEpoch = (nextEpoch: number) => {
  authEpoch = nextEpoch;
  generation += 1;
  pending = undefined;
  terminalEpoch = undefined;
  lastGood = [];
  snapshot = { status: 'idle', items: [] };
  emit();
};

subscribeAuthSession(() => {
  const nextEpoch = getAuthSessionSnapshot().epoch;
  if (nextEpoch !== authEpoch) clearForAuthEpoch(nextEpoch);
});

const catalogItems = (boards: readonly Board[]): readonly BoardCatalogItem[] => boards
  .filter((board) => !board.config.isHidden && board.title.value !== null)
  .map((board) => ({ code: board.code, title: board.title.value! }));

export function loadBoardCatalog(): Promise<readonly BoardCatalogItem[]> {
  const auth = getAuthSessionSnapshot();
  if (auth.status !== 'ready') return Promise.resolve(snapshot.items);
  if (terminalEpoch === auth.epoch) return Promise.reject(snapshot.error);
  if (pending) return pending;

  const requestGeneration = generation;
  const requestEpoch = auth.epoch;
  snapshot = { status: 'loading', items: [] };
  emit();
  const request = boardApi.list({ locale: 'ko' })
    .then(({ items }) => {
      const result = catalogItems(items);
      if (requestGeneration === generation && requestEpoch === authEpoch) {
        lastGood = result;
        snapshot = { status: 'ready', items: result };
        emit();
      }
      return result;
    })
    .catch((error: unknown) => {
      if (requestGeneration === generation && requestEpoch === authEpoch) {
        if (error instanceof BoardApiError && error.status === 401) {
          terminalEpoch = requestEpoch;
          generation += 1;
          pending = undefined;
          lastGood = [];
          snapshot = { status: 'error', items: [], error };
        } else {
          snapshot = { status: 'error', items: [], error };
        }
        emit();
      }
      throw error;
    })
    .finally(() => {
      if (requestGeneration === generation && requestEpoch === authEpoch) pending = undefined;
    });
  pending = request;
  return request;
}

export function invalidateBoardCatalog(): void {
  if (terminalEpoch === authEpoch) return;
  generation += 1;
  pending = undefined;
  snapshot = { status: 'idle', items: [] };
  emit();
}

export function useBoardCatalog(): BoardCatalogSnapshot {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (getSnapshot().status === 'idle' && getAuthSessionSnapshot().status === 'ready') {
      void loadBoardCatalog().catch(() => undefined);
    }
  }, [current]);
  return current;
}
