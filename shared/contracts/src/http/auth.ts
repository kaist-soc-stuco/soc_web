/**
 * 인증 / 세션 / 개인정보 동의 플로우 공용 contract 골격입니다.
 *
 * TODO:
 * - backend DTO와 1:1로 맞추고, 필드명은 camelCase로 통일하세요.
 * - contract를 바꿀 때는 api-client와 프런트 사용처를 같이 업데이트하세요.
 */

export type AuthStorageMode = "temporary" | "persisted";

export interface LoginStartResponse {
  clientId: string;
  loginUrl: string;
  nonce: string;
  redirectUri: string;
  state: string;
}

export interface LoginSessionResponse {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  requiresConsent: boolean;
  storageMode: AuthStorageMode | null;
  userId?: string;
}

export interface ConsentDecisionRequest {
  consent: boolean;
  pendingLoginToken: string;
}

export interface ConsentDecisionResponse {
  accessToken?: string;
  refreshToken?: string;
  storageMode: AuthStorageMode;
  userId?: string;
}

export interface RefreshResponse {
  accessToken: string;
  storageMode: AuthStorageMode;
}

export interface LogoutResponse {
  ok: boolean;
}
