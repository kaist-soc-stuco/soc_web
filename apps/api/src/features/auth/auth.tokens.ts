/**
 * Auth 토큰/쿠키/TTL 상수 모음입니다.
 *
 * TODO:
 * - access/refresh TTL은 보안 정책과 UX를 같이 보고 조정하세요.
 * - Caddy/nginx 뒤에서 cookie path, secure, sameSite 정책도 함께 반영하세요.
 */

export const AUTH_ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
export const AUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/**
 * 개인정보 저장에 동의하지 않은 세션은 refresh token을 발급하지 않고
 * 짧은 수명의 access token만 사용합니다.
 */
export const AUTH_TEMPORARY_ACCESS_TOKEN_TTL_SECONDS = 10 * 60;

export const AUTH_ACCESS_COOKIE_NAME = "soc_access_token";
export const AUTH_REFRESH_COOKIE_NAME = "soc_refresh_token";
export const AUTH_SESSION_COOKIE_NAME = "soc_session_id";
export const AUTH_TEMPORARY_STORAGE_KEY = "soc.auth.temporary-session";

export const extractBearerToken = (
  authorization?: string,
): string | undefined => {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
};
