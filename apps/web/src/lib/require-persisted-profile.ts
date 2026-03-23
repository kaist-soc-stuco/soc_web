import type { AuthSession } from "./auth-session";

/**
 * 개인정보 영구 저장이 필요한 기능에 접근 가능한지 검사하는 최소 헬퍼입니다.
 *
 * TODO:
 * - 이 함수를 route guard / button disable / API call guard 중 어디서 쓸지 통일하세요.
 * - 문구는 여기서 만들지 말고 UI layer에서 처리하세요.
 */
export const hasPersistedProfile = (session: AuthSession | null): boolean =>
  Boolean(
    session?.authenticated &&
    session.storageMode === "persisted" &&
    session.canUsePersistentFeatures,
  );
