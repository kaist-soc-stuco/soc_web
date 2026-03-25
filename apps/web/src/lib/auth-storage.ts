/**
 * 프런트 토큰 저장소 스켈레톤입니다.
 *
 * TODO:
 * - temporary 로그인은 sessionStorage만 사용하도록 유지하세요.
 * - persisted 로그인은 refresh token을 직접 저장하지 말고 access token 관리 정책만 확정하세요.
 */

export interface StoredAuthState {
  accessToken?: string;
  pendingLoginToken?: string;
  refreshToken?: string;
  sessionId?: string;
  storageMode?: "temporary" | "persisted";
  userId?: string;
}

const STORAGE_KEY = "soc.auth.state";

export const readStoredAuthState = (): StoredAuthState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthState;
  } catch {
    return null;
  }
};

export const writeStoredAuthState = (value: StoredAuthState): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const clearStoredAuthState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
};
