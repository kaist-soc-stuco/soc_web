export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const SESSION_REFRESH_THROTTLE_MS = 9 * 60 * 1000;

export const isSessionIdle = (
  lastActivityAt: number,
  now: number,
): boolean => now - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS;

export const initialSessionActivityAt = (
  storedActivityAt: number,
  now: number,
): number => storedActivityAt > 0 ? storedActivityAt : now;

export const shouldRefreshActiveSession = (
  lastActivityAt: number,
  lastRefreshAt: number,
  now: number,
): boolean =>
  !isSessionIdle(lastActivityAt, now) &&
  now - lastRefreshAt >= SESSION_REFRESH_THROTTLE_MS;

export const idleLogoutDelay = (
  lastActivityAt: number,
  now: number,
): number => Math.max(SESSION_IDLE_TIMEOUT_MS - (now - lastActivityAt), 0);
