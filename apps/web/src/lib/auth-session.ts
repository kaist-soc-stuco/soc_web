/**
 * 현재 로그인 세션을 표현하는 프런트 공용 타입/헬퍼 골격입니다.
 *
 * TODO:
 * - `/auth/session` 응답 형식과 정확히 같은 필드로 맞추세요.
 * - `temporary` / `persisted`에 따라 UI와 권한 분기를 어디서 할지 먼저 정하세요.
 */
export type AuthStorageMode = "temporary" | "persisted";

export interface AuthSession {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  requiresConsent: boolean;
  storageMode: AuthStorageMode | null;
  userId?: string;
}

/**
 * TODO:
 * - `/auth/session` 호출 + refresh 처리 + error recovery를 한 곳에서 관리하세요.
 */
export const createEmptyAuthSession = (): AuthSession => ({
  authenticated: false,
  canUsePersistentFeatures: false,
  requiresConsent: false,
  storageMode: null,
});
