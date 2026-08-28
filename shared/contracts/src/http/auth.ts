/**
 * 인증 / 세션 / 개인정보 동의 플로우 공용 contract 골격입니다.
 *
 * TODO:
 * - backend DTO와 1:1로 맞추고, 필드명은 camelCase로 통일하세요.
 * - contract를 바꿀 때는 api-client와 프런트 사용처를 같이 업데이트하세요.
 */

import type { z } from "zod";
import type { ConsentDecisionSchema } from "../schemas.js";

export type AuthStorageMode = "temporary" | "persisted";

/** The complete account object returned by the SSO provider. */
export type SsoUserInfo = Record<string, unknown>;

export interface LoginStartResponse {
  clientId: string;
  loginUrl: string;
  nonce: string;
  redirectUri: string;
  state: string;
}

export interface ChannelTalkConfigResponse {
  enabled: boolean;
  language: "ko" | "en";
  pluginKey?: string;
  memberId?: string;
  memberHash?: string;
  profile?: {
    name: string;
    email: string;
  };
}

export interface LoginSessionResponse {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  permission?: number;
  requiresConsent: boolean;
  storageMode: AuthStorageMode | null;
  userId?: string;
  userName?: string;
  nameKo?: string;
  nameEn?: string | null;
}

export interface CurrentUserResponse {
  authenticated: boolean;
  storageMode: AuthStorageMode | null;
  user?: {
    id: string;
    name?: string;
    permission: number;
    email: string;
    nameKo: string;
    nameEn: string | null;
    studentNumber: string | null;
    departmentKo: string | null;
    departmentEn: string | null;
    primaryMajor: string | null;
    feeStatus: "PAID" | "PARTIAL" | "UNPAID" | null;
    academicStatus: string | null;
  };
}

export type ConsentDecisionRequest = z.infer<typeof ConsentDecisionSchema>;

export interface TemporarySessionPayload {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
}

export interface ConsentDecisionResponse {
  storageMode: AuthStorageMode;
  ssoUserInfo?: SsoUserInfo;
  temporarySession?: TemporarySessionPayload;
  userId?: string;
}

export interface RefreshResponse {
  storageMode: AuthStorageMode;
  temporarySession?: TemporarySessionPayload;
}

export interface LogoutResponse {
  ok: boolean;
}
