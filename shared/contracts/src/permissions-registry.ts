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
  WRITE_OFFICIAL: "WRITE_OFFICIAL",
  WRITE_LAB: "WRITE_LAB",
  WRITE_REPLY: "WRITE_REPLY",
  MANAGE_SURVEY: "MANAGE_SURVEY",
  MANAGE_FINANCE: "MANAGE_FINANCE",
  MANAGE_SITE_CONTENT: "MANAGE_SITE_CONTENT",
  MANAGE_CALENDAR: "MANAGE_CALENDAR",
  MANAGE_CONTACTS: "MANAGE_CONTACTS",
  MANAGE_USERS: "MANAGE_USERS",
  MODERATE_CONTENT: "MODERATE_CONTENT",
  MANAGE_BOARDS: "MANAGE_BOARDS",
  SEND_BULK_EMAIL: "SEND_BULK_EMAIL",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
  MANAGE_ROLES: "MANAGE_ROLES",
  MANAGE_VOTE: "MANAGE_VOTE",
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
    code: PermissionCode.WRITE_OFFICIAL,
    bit: 1,
    labelKo: "공지·행사·HoC·홍보 작성",
    labelEn: "Write official content",
    description: "공지, 행사, HoC와 홍보 게시글을 작성할 수 있습니다.",
  },
  {
    code: PermissionCode.WRITE_LAB,
    bit: 2,
    labelKo: "연구실 게시판 작성",
    labelEn: "Write lab posts",
    description: "연구실 게시판에 글을 작성할 수 있습니다.",
  },
  {
    code: PermissionCode.WRITE_REPLY,
    bit: 4,
    labelKo: "공식 답변",
    labelEn: "Write Reply",
    description: "건의사항에 공식 답변을 작성하고 상태를 변경할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_SURVEY,
    bit: 8,
    labelKo: "설문조사 관리",
    labelEn: "Manage Survey",
    description: "일반 설문과 행사 신청폼을 만들고 응답과 결과를 확인할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_FINANCE,
    bit: 16,
    labelKo: "과비 관리",
    labelEn: "Manage Finance",
    description: "학생회비 납부 상태를 확인·수정하고 독촉 메일을 발송할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_SITE_CONTENT,
    bit: 32,
    labelKo: "사이트 설정",
    labelEn: "Manage site content",
    description: "홈 히어로, 띠배너, 퀵링크, 조직도와 공약을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_CALENDAR,
    bit: 64,
    labelKo: "일정 관리",
    labelEn: "Manage calendar",
    description: "학생회 일정과 외부 동기화 일정을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_CONTACTS,
    bit: 128,
    labelKo: "연락망 관리",
    labelEn: "Manage contacts",
    description: "집행위원회 내부 연락망을 관리하고 내보낼 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_USERS,
    bit: 256,
    labelKo: "사용자 관리",
    labelEn: "Manage users",
    description: "사용자 정보와 계정 상태, 운영 제재를 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MODERATE_CONTENT,
    bit: 512,
    labelKo: "게시글·댓글 관리",
    labelEn: "Moderate content",
    description: "게시글과 댓글을 숨기고 복원하며 익명 작성자를 확인할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_BOARDS,
    bit: 1024,
    labelKo: "게시판 설정",
    labelEn: "Manage boards",
    description: "게시판과 읽기·쓰기 범위, 제공 기능을 설정할 수 있습니다.",
  },
  {
    code: PermissionCode.SEND_BULK_EMAIL,
    bit: 2048,
    labelKo: "이메일 일괄 발송",
    labelEn: "Send bulk email",
    description: "수신자를 필터링하고 템플릿과 일괄 발송을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.VIEW_AUDIT_LOG,
    bit: 4096,
    labelKo: "운영 로그 조회",
    labelEn: "View audit log",
    description: "관리자 작업과 보안 관련 운영 로그를 조회할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_ROLES,
    bit: 8192,
    labelKo: "권한·역할 관리",
    labelEn: "Manage roles",
    description: "운영 역할을 만들고 권한과 구성원을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_VOTE,
    bit: 32768,
    labelKo: "투표 관리",
    labelEn: "Manage votes",
    description: "전산학부 주전공 학부생 대상 비밀투표를 만들고 명부·투표율·결과를 관리할 수 있습니다.",
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
 * // 복수 체크 (AND — 모두 만족해야 함)
 * Permissions.has(userMask, Permissions.WRITE_OFFICIAL, Permissions.MODERATE_CONTENT);
 *
 * // 하나라도 만족하면 OK (OR)
 * Permissions.hasAny(userMask, Permissions.WRITE_OFFICIAL, Permissions.MODERATE_CONTENT);
 *
 * // 권한 부여/해제
 * const newMask = Permissions.grant(mask, Permissions.WRITE_OFFICIAL);
 * const revoked = Permissions.revoke(mask, Permissions.WRITE_OFFICIAL);
 * ```
 */
export const Permissions = {
  // ── Bit value constants (convenience) ──────────────────────────────────
  WRITE_OFFICIAL: 1,
  WRITE_LAB: 2,
  WRITE_REPLY: 4,
  MANAGE_SURVEY: 8,
  MANAGE_FINANCE: 16,
  MANAGE_SITE_CONTENT: 32,
  MANAGE_CALENDAR: 64,
  MANAGE_CONTACTS: 128,
  MANAGE_USERS: 256,
  MODERATE_CONTENT: 512,
  MANAGE_BOARDS: 1024,
  SEND_BULK_EMAIL: 2048,
  VIEW_AUDIT_LOG: 4096,
  MANAGE_ROLES: 8192,
  MANAGE_VOTE: 32768,

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

/** Every authenticated member receives these non-administrative capabilities. */
export const DEFAULT_AUTHENTICATED_PERMISSION_BITS = Permissions.WRITE_LAB;

/**
 * reference seed와 최초 관리자 자동 부여가 함께 사용하는 시스템 역할 이름입니다.
 * 시스템 역할은 관리자 UI에서 수정하거나 삭제할 수 없습니다.
 */
export const INITIAL_ADMIN_ROLE_GROUP_NAME = "최고 관리자";
