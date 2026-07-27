import type { LoginSessionResponse } from "@soc/contracts";


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
  getSession: () => Promise<LoginSessionResponse>;
}

/**
 * 세션 조회 실패 시에도 화면이 깨지지 않도록 기본 세션으로 복구합니다.
 */
export const getAuthSessionSummary = async (
  apiClient: SessionApiClient,
): Promise<AuthSession> => {
  try {
    return await apiClient.getSession();
  } catch {
    return createEmptyAuthSession();
  }
};
