/**
 * ── Permission Single Source of Truth ─────────────────────────────────────────
 *
 * 모든 permission bit 값, 코드, 라벨은 여기서만 정의합니다.
 * 프론트엔드, 백엔드, DB seed 모두 이 파일을 참조해야 합니다.
 *
 * bit 값은 2의 거듭제곱이어야 합니다 (1, 2, 4, 8, 16, 32, 64, 128, 256, ...).
 * 새 권한을 추가할 때는 기존 bit 값을 변경하지 말고, 다음 2의 거듭제곱을 사용하세요.
 */

// ─── Permission Code enum ────────────────────────────────────────────────────

export const PermissionCode = {
  WRITE_NOTICE: "WRITE_NOTICE",
  WRITE_GENERAL: "WRITE_GENERAL",
  WRITE_REPLY: "WRITE_REPLY",
  MANAGE_SURVEY: "MANAGE_SURVEY",
  MANAGE_FINANCE: "MANAGE_FINANCE",
  MANAGE_CONTENT: "MANAGE_CONTENT",
  MANAGE_TOOL: "MANAGE_TOOL",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

// ─── Permission Definition ───────────────────────────────────────────────────

export interface PermissionDefinition {
  /** 문자열 코드. DB `permission.code`와 일치해야 합니다. */
  code: PermissionCode;
  /** 2^n 비트 값. DB `permission.bit_value`와 일치해야 합니다. */
  bit: number;
  /** 한국어 라벨 */
  labelKo: string;
  /** 영어 라벨 */
  labelEn: string;
  /** 설명 */
  description: string;
}

/**
 * 전체 권한 정의 목록.
 * 이 배열이 DB seed, 프론트 UI, 백엔드 Guard의 유일한 진실 원천(SSOT)입니다.
 */
export const PERMISSION_REGISTRY: readonly PermissionDefinition[] = [
  {
    code: PermissionCode.WRITE_NOTICE,
    bit: 1,
    labelKo: "공지/행사 작성",
    labelEn: "Write Notice",
    description: "공식 공지 및 행사 게시글 작성 권한",
  },
  {
    code: PermissionCode.WRITE_GENERAL,
    bit: 2,
    labelKo: "일반/홍보 작성",
    labelEn: "Write General",
    description: "홍보, HoC, 연구실 등 일반 게시글 작성 권한",
  },
  {
    code: PermissionCode.WRITE_REPLY,
    bit: 4,
    labelKo: "공식 답변",
    labelEn: "Write Reply",
    description: "QnA/건의사항 공식 답변 및 상태 변경 권한",
  },
  {
    code: PermissionCode.MANAGE_SURVEY,
    bit: 8,
    labelKo: "설문조사 관리",
    labelEn: "Manage Survey",
    description: "설문조사, 투표, 단체구매 생성 및 결과 열람 권한",
  },
  {
    code: PermissionCode.MANAGE_FINANCE,
    bit: 16,
    labelKo: "과비 관리",
    labelEn: "Manage Finance",
    description: "과비 납부 시트 관리 및 독촉 메일 발송 권한",
  },
  {
    code: PermissionCode.MANAGE_CONTENT,
    bit: 32,
    labelKo: "콘텐츠 관리",
    labelEn: "Manage Content",
    description: "홈 화면, 배너, 로드맵, 캘린더 등 정보성 콘텐츠 수정 권한",
  },
  {
    code: PermissionCode.MANAGE_TOOL,
    bit: 64,
    labelKo: "도구 관리",
    labelEn: "Manage Tool",
    description: "POM 채점기, 챗봇 등 기술 도구 데이터 관리 권한",
  },
  {
    code: PermissionCode.MODERATOR,
    bit: 128,
    labelKo: "유저/게시글 관리",
    labelEn: "Moderator",
    description: "타인 게시글 삭제 및 일반 유저 제재 권한",
  },
  {
    code: PermissionCode.ADMIN,
    bit: 256,
    labelKo: "최고 관리자",
    labelEn: "Admin",
    description: "역할 그룹 CRUD와 권한 부여 권한",
  },
] as const;

// ─── Lookup helpers ──────────────────────────────────────────────────────────

const _bitByCode = new Map<string, number>(
  PERMISSION_REGISTRY.map((p) => [p.code, p.bit]),
);

const _codeByBit = new Map<number, string>(
  PERMISSION_REGISTRY.map((p) => [p.bit, p.code]),
);

/** code → bit 변환. 없으면 0 반환 */
export const bitOf = (code: PermissionCode): number =>
  _bitByCode.get(code) ?? 0;

/** bit → code 변환. 없으면 undefined */
export const codeOf = (bit: number): PermissionCode | undefined =>
  _codeByBit.get(bit) as PermissionCode | undefined;

// ─── Bitmask Wrapper ─────────────────────────────────────────────────────────

/**
 * 비트마스크를 우아하게 다루기 위한 래퍼 객체.
 *
 * @example
 * ```ts
 * import { Permissions, PermissionCode } from "@soc/contracts";
 *
 * // bit 값으로 직접 체크
 * Permissions.has(userMask, Permissions.ADMIN);
 *
 * // code 문자열로 체크
 * Permissions.hasCode(userMask, PermissionCode.ADMIN);
 *
 * // 복수 체크 (AND — 모두 만족해야 함)
 * Permissions.has(userMask, Permissions.WRITE_NOTICE, Permissions.MODERATOR);
 *
 * // 하나라도 만족하면 OK (OR)
 * Permissions.hasAny(userMask, Permissions.ADMIN, Permissions.MODERATOR);
 *
 * // 권한 부여/해제
 * const newMask = Permissions.grant(mask, Permissions.WRITE_NOTICE);
 * const revoked = Permissions.revoke(mask, Permissions.ADMIN);
 * ```
 */
export const Permissions = {
  // ── Bit value constants (convenience) ──────────────────────────────────
  WRITE_NOTICE: 1,
  WRITE_GENERAL: 2,
  WRITE_REPLY: 4,
  MANAGE_SURVEY: 8,
  MANAGE_FINANCE: 16,
  MANAGE_CONTENT: 32,
  MANAGE_TOOL: 64,
  MODERATOR: 128,
  ADMIN: 256,

  // ── Checks ─────────────────────────────────────────────────────────────

  /** mask가 주어진 모든 bit를 포함하는지 확인합니다 (AND). */
  has(mask: number, ...bits: number[]): boolean {
    if (bits.length === 0) return true;
    const required = bits.reduce((acc, b) => acc | b, 0);
    return required === 0 || (mask & required) === required;
  },

  /** mask가 주어진 bit 중 하나라도 포함하는지 확인합니다 (OR). */
  hasAny(mask: number, ...bits: number[]): boolean {
    if (bits.length === 0) return true;
    const combined = bits.reduce((acc, b) => acc | b, 0);
    return combined === 0 || (mask & combined) !== 0;
  },

  /** PermissionCode 문자열로 권한 체크 (AND). */
  hasCode(mask: number, ...codes: PermissionCode[]): boolean {
    return Permissions.has(mask, ...codes.map(bitOf));
  },

  /** PermissionCode 문자열로 권한 체크 (OR). */
  hasAnyCode(mask: number, ...codes: PermissionCode[]): boolean {
    return Permissions.hasAny(mask, ...codes.map(bitOf));
  },

  // ── Mutations ──────────────────────────────────────────────────────────

  /** mask에 bit들을 추가합니다. */
  grant(mask: number, ...bits: number[]): number {
    return bits.reduce((acc, b) => acc | b, mask);
  },

  /** mask에서 bit들을 제거합니다. */
  revoke(mask: number, ...bits: number[]): number {
    return bits.reduce((acc, b) => acc & ~b, mask);
  },

  // ── Introspection ──────────────────────────────────────────────────────

  /** mask에 포함된 모든 PermissionDefinition 목록을 반환합니다. */
  granted(mask: number): readonly PermissionDefinition[] {
    return PERMISSION_REGISTRY.filter((p) => (mask & p.bit) === p.bit);
  },
} as const;
