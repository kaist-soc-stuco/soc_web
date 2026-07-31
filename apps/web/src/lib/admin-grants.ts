import { useSyncExternalStore } from 'react';
import type { EffectivePermissionGrant } from '@soc/contracts';
import { adminIdentityApi } from './admin-identity-api';

export type AdminGrantsSnapshot =
  | { status: 'idle'; grants: readonly EffectivePermissionGrant[] }
  | { status: 'loading'; grants: readonly EffectivePermissionGrant[] }
  | { status: 'ready'; grants: readonly EffectivePermissionGrant[] }
  | { status: 'error'; grants: readonly EffectivePermissionGrant[] };

let snapshot: AdminGrantsSnapshot = { status: 'idle', grants: [] };
let loadPromise: Promise<readonly EffectivePermissionGrant[]> | undefined;
let generation = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;

export function loadAdminGrants(): Promise<readonly EffectivePermissionGrant[]> {
  if (loadPromise) return loadPromise;
  const requestGeneration = generation;
  snapshot = { status: 'loading', grants: snapshot.grants };
  emit();
  const pending = adminIdentityApi.getCurrentUser()
    .then(({ grants }) => {
      if (requestGeneration === generation) {
        snapshot = { status: 'ready', grants };
        emit();
      }
      return grants;
    })
    .catch((error: unknown) => {
      if (requestGeneration === generation) {
        snapshot = { status: 'error', grants: [] };
        emit();
      }
      throw error;
    })
    .finally(() => {
      if (requestGeneration === generation) loadPromise = undefined;
    });
  loadPromise = pending;
  return pending;
}

export function invalidateAdminGrants(): void {
  generation += 1;
  loadPromise = undefined;
  snapshot = { status: 'idle', grants: [] };
  emit();
}

export async function refetchAdminGrants(): Promise<readonly EffectivePermissionGrant[]> {
  invalidateAdminGrants();
  return loadAdminGrants();
}

export function useAdminGrants(): AdminGrantsSnapshot {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (current.status === 'idle') void loadAdminGrants().catch(() => undefined);
  return current;
}
