import { Injectable } from "@nestjs/common";

import type { AuthSessionRecord } from "./auth.types";

/**
 * Redis 기반 auth session 저장소 골격입니다.
 *
 * TODO:
 * 1. refresh token rotation에 필요한 session metadata 저장 구조를 먼저 확정하세요.
 * 2. create / read / revoke / rotate 순서로 구현하세요.
 * 3. Redis key naming 규칙과 TTL 정책을 문서에 남기세요.
 */
@Injectable()
export class AuthSessionRepository {
  /**
   * 세션 메타데이터를 저장합니다.
   *
   * @param _record 저장할 세션 레코드
   * @returns Promise<void>
   */
  async save(_record: AuthSessionRecord): Promise<void> {
    throw new Error("TODO: Redis에 auth session record 저장 구현");
  }

  /**
   * 세션 ID로 저장된 세션 메타데이터를 조회합니다.
   *
   * @param _sessionId 세션 식별자
   * @returns 세션 레코드 또는 null
   */
  async findBySessionId(_sessionId: string): Promise<AuthSessionRecord | null> {
    throw new Error("TODO: Redis에서 auth session record 조회 구현");
  }

  /**
   * 세션을 revoke 상태로 바꿉니다.
   *
   * @param _sessionId 세션 식별자
   * @returns Promise<void>
   */
  async revoke(_sessionId: string): Promise<void> {
    throw new Error("TODO: Redis에서 auth session revoke 구현");
  }
}
