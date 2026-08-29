import type { LoginSessionResponse } from "@soc/contracts";
import { ApiClientHttpError } from "@soc/api-client";

import {
  clearStoredAuthState,
  readStoredAuthState,
} from "@/lib/auth-storage";

/**
 * 현재 로그인 세션을 표현하는 프런트 공용 타입/헬퍼입니다.
 */
export type AuthStorageMode = "temporary" | "persisted";

export type AuthSession = LoginSessionResponse;

export const createEmptyAuthSession = (): AuthSession => ({
  authenticated: false,
  canUsePersistentFeatures: false,
  requiresConsent: false,
  storageMode: null,
});

export interface SessionApiClient {
  getSession: (sessionId?: string) => Promise<LoginSessionResponse>;
}

export const getTemporarySessionId = (): string | undefined => {
  // Temporary sessions are stateless JWTs; the bearer token is attached by
  // the shared API client and no server-side session ID is issued.
  return undefined;
};

/**
 * 세션 조회 실패 시에도 화면이 깨지지 않도록 기본 세션으로 복구합니다.
 */
export const getAuthSessionSummary = async (
  apiClient: SessionApiClient,
): Promise<AuthSession> => {
  const temporarySessionId = getTemporarySessionId();

  try {
    const session = await apiClient.getSession(temporarySessionId);
    if (!session.authenticated && readStoredAuthState()?.temporarySession) {
      clearStoredAuthState();
    }
    return session;
  } catch (error) {
    if (
      error instanceof ApiClientHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      clearStoredAuthState();
    }

    return createEmptyAuthSession();
  }
};
