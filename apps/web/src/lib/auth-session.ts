import type { LoginSessionResponse } from "@soc/contracts";
import { ApiClientHttpError } from "@soc/api-client";

import {
  clearStoredAuthState,
  readStoredAuthState,
} from "./auth-storage";

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
 * 인증 실패만 비로그인 상태로 변환합니다. 통신 오류는 쿼리 캐시가 기존 세션을 유지하도록 전달합니다.
 */
export const getAuthSessionSummary = async (
  apiClient: SessionApiClient,
): Promise<AuthSession> => {
  const temporarySessionId = getTemporarySessionId();
  const temporaryAccessTokenAtStart =
    readStoredAuthState()?.temporarySession?.accessToken;

  try {
    const session = await apiClient.getSession(temporarySessionId);
    // A session request can have started before a login or account switch and
    // finish afterwards. Only clear the token that this request observed; a
    // late unauthenticated response must never erase a newer temporary login.
    if (
      !session.authenticated &&
      temporaryAccessTokenAtStart &&
      readStoredAuthState()?.temporarySession?.accessToken ===
        temporaryAccessTokenAtStart
    ) {
      clearStoredAuthState();
    }
    return session;
  } catch (error) {
    if (
      error instanceof ApiClientHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      clearStoredAuthState();
      return createEmptyAuthSession();
    }

    throw error;
  }
};
