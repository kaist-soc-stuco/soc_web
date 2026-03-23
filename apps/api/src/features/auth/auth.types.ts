/**
 * SSO 로그인 이후 개인정보 동의 / 임시 로그인 / 영구 로그인 흐름에서
 * 공통으로 사용할 타입 정의 모음입니다.
 *
 * TODO:
 * - 아래 타입을 기준으로 controller/service/repository의 입출력을 먼저 통일하세요.
 * - 실제 구현 전에 "temporary"와 "persisted" 모드의 책임을 문서로 다시 확인하세요.
 * - 구현 후에는 contract(package/contracts)와 완전히 같은 필드를 쓰는지 검증하세요.
 */

export type StorageMode = "temporary" | "persisted";

/**
 * Redis에 잠시 저장해 두는 SSO 사용자 정보입니다.
 *
 * TODO:
 * - 실제 SSO 응답에서 어떤 필드를 저장할지 최소화하세요.
 * - 원본 개인정보를 토큰에 직접 넣지 말고, Redis/PostgreSQL에만 저장하세요.
 */
export interface PendingSsoUser {
  expiresAt: number;
  nonce: string;
  ssoUserId: string;
  userEmail?: string;
  userMobile?: string;
}

/**
 * access token 안에 들어갈 공통 클레임입니다.
 *
 * TODO:
 * - 실제 토큰 구현 시 issuer, audience, iat, exp 등도 함께 정의하세요.
 * - temporary/persisted 모드에 따라 추가 클레임을 분리하세요.
 */
export interface BaseAccessTokenClaims {
  mode: StorageMode;
  sub: string;
}

/**
 * 개인정보 저장에 동의하지 않은 임시 로그인용 access token 클레임입니다.
 */
export interface TemporaryAccessTokenClaims extends BaseAccessTokenClaims {
  mode: "temporary";
  pendingLoginId: string;
}

/**
 * PostgreSQL에 저장된 사용자의 정식 로그인용 access token 클레임입니다.
 */
export interface PersistedAccessTokenClaims extends BaseAccessTokenClaims {
  mode: "persisted";
  userId: string;
}

/**
 * refresh token에서 사용할 기본 클레임입니다.
 *
 * TODO:
 * - jti/세션 식별자 기반 rotation 전략을 먼저 정하고 구현하세요.
 */
export interface RefreshTokenClaims {
  jti: string;
  mode: StorageMode;
  sid: string;
  sub: string;
}

/**
 * Redis에 저장할 세션 메타데이터입니다.
 *
 * TODO:
 * - refresh token 원문 대신 해시 또는 jti 기반으로 저장하세요.
 * - rotatedFrom / revokedAt 등을 추가할지 결정하세요.
 */
export interface AuthSessionRecord {
  expiresAt: number;
  mode: StorageMode;
  pendingLoginId?: string;
  revoked: boolean;
  sessionId: string;
  userId?: string;
}

/**
 * 개인정보 저장 동의 제출 DTO입니다.
 */
export interface ConsentDecisionRequest {
  consent: boolean;
  pendingLoginToken: string;
}

/**
 * refresh 요청 DTO입니다.
 *
 * TODO:
 * - persisted는 cookie 기반으로 바꿀 수 있으므로 body 기반 전달이 최종형이 아닐 수 있습니다.
 */
export interface RefreshSessionRequest {
  refreshToken?: string;
  sessionId?: string;
}

/**
 * 현재 로그인 세션 상태를 프런트에 전달하기 위한 응답 DTO입니다.
 */
export interface AuthSessionSummary {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  requiresConsent: boolean;
  storageMode: StorageMode | null;
  userId?: string;
}
