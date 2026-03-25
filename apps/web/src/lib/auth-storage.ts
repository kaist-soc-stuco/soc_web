/**
 * 프런트 인증 보조 상태 저장소입니다.
 *
 * 쿠키 기반 인증으로 전환되어 access/refresh/session 토큰은 브라우저 쿠키로 관리합니다.
 * sessionStorage에는 consent 단계 연결에 필요한 pendingLoginToken만 저장합니다.
 */

export interface StoredAuthState {
  pendingLoginToken?: string;
  temporarySession?: {
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
  };
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
