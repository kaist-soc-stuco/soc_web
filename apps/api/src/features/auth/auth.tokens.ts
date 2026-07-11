/**
 * Auth 토큰/쿠키/TTL 상수 모음입니다.
 *
 * TODO:
 * - access/refresh TTL은 보안 정책과 UX를 같이 보고 조정하세요.
 * - Caddy/nginx 뒤에서 cookie path, secure, sameSite 정책도 함께 반영하세요.
 */

export const AUTH_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const AUTH_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const AUTH_TEMPORARY_REFRESH_TTL_SECONDS = 8 * 60 * 60;

export const AUTH_ACCESS_COOKIE_NAME = "soc_access_token";
export const AUTH_REFRESH_COOKIE_NAME = "soc_refresh_token";
export const AUTH_SESSION_COOKIE_NAME = "soc_session_id";
export const AUTH_TEMPORARY_STORAGE_KEY = "soc.auth.temporary-session";
