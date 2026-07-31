import { useSyncExternalStore } from "react";
import type { LoginSessionResponse } from "@soc/contracts";


/**
 * 현재 로그인 세션을 표현하는 프런트 공용 타입/헬퍼입니다.
 */
export type AuthStorageMode = "temporary" | "persisted";

export type AuthSession = LoginSessionResponse;
export interface AuthSessionSnapshot {
  readonly epoch: number;
  readonly status: "unknown" | "ready";
  readonly session: AuthSession;
}

let snapshot: AuthSessionSnapshot = {
  epoch: 0,
  status: "unknown",
  session: {
    authenticated: false,
    canUsePersistentFeatures: false,
    requiresConsent: false,
    storageMode: null,
  },
};
let transitionAwaitingConfirmation = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const subscribeAuthSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAuthSessionSnapshot = (): AuthSessionSnapshot => snapshot;

export const setAuthSession = (session: AuthSession): void => {
  if (snapshot.status === "unknown" && transitionAwaitingConfirmation) {
    transitionAwaitingConfirmation = false;
    snapshot = { ...snapshot, status: "ready", session };
    emit();
    return;
  }

  const changed = snapshot.status !== "ready"
    || snapshot.session.authenticated !== session.authenticated
    || snapshot.session.userId !== session.userId;
  if (!changed) {
    snapshot = { ...snapshot, session };
    emit();
    return;
  }
  snapshot = { epoch: snapshot.epoch + 1, status: "ready", session };
  emit();
};

export const useAuthSession = (): AuthSessionSnapshot =>
  useSyncExternalStore(subscribeAuthSession, getAuthSessionSnapshot, getAuthSessionSnapshot);

export const createEmptyAuthSession = (): AuthSession => ({
  authenticated: false,
  canUsePersistentFeatures: false,
  requiresConsent: false,
  storageMode: null,
});

export interface SessionApiClient {
  getSession: () => Promise<LoginSessionResponse>;
}

/**
 * A session observation is only allowed to publish while its identity generation
 * remains current. Authentication transitions invalidate in-flight observations.
 */
export const getAuthSessionSummary = async (
  apiClient: SessionApiClient,
): Promise<AuthSession> => {
  const generation = snapshot.epoch;
  try {
    const session = await apiClient.getSession();
    if (generation !== snapshot.epoch) return snapshot.session;
    setAuthSession(session);
    return session;
  } catch (error) {
    if (generation !== snapshot.epoch) return snapshot.session;
    if (typeof error === "object" && error !== null && "status" in error && error.status === 401) {
      const empty = createEmptyAuthSession();
      setAuthSession(empty);
      return empty;
    }
    throw error;
  }
};

export const beginAuthSessionTransition = (): void => {
  transitionAwaitingConfirmation = true;
  snapshot = {
    epoch: snapshot.epoch + 1,
    status: "unknown",
    session: createEmptyAuthSession(),
  };
  emit();
};
