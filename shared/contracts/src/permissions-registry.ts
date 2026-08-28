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
  POST_CREATE: "POST_CREATE",
  POST_OFFICIAL: "POST_OFFICIAL",
  POST_ANNOUNCEMENT: "POST_ANNOUNCEMENT",
  VIEW_SECRET_POST: "VIEW_SECRET_POST",
  COMMENT_CREATE: "COMMENT_CREATE",
  MODERATE_POST_COMMENT: "MODERATE_POST_COMMENT",
  MANAGE_SUGGESTION_REPLY: "MANAGE_SUGGESTION_REPLY",
  MANAGE_BOARD_SETTINGS: "MANAGE_BOARD_SETTINGS",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  MANAGE_FINANCE: "MANAGE_FINANCE",
  MANAGE_SITE_CONTENT: "MANAGE_SITE_CONTENT",
  MANAGE_POLL: "MANAGE_POLL",
  VIEW_USERS: "VIEW_USERS",
  MANAGE_USERS: "MANAGE_USERS",
  VIEW_CONTACTS: "VIEW_CONTACTS",
  MANAGE_CONTACTS: "MANAGE_CONTACTS",
  SEND_EMAIL: "SEND_EMAIL",
  MANAGE_SURVEY: "MANAGE_SURVEY",
  MANAGE_CALENDAR: "MANAGE_CALENDAR",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
  SUPER_ADMIN: "SUPER_ADMIN",
  /** @deprecated Use POST_OFFICIAL. Kept as a source-compatible alias only. */
  WRITE_REPLY: "MANAGE_SUGGESTION_REPLY",
  /** @deprecated Use SUPER_ADMIN. This code is not assignable in the UI. */
  ADMIN: "SUPER_ADMIN",
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
  /** 시스템 부트스트랩 전용 권한은 일반 역할 편집 화면에서 숨깁니다. */
  isSystemOnly?: boolean;
}

/**
 * 전체 권한 정의 목록.
 * 이 배열이 DB seed, 프론트 UI, 백엔드 Guard의 유일한 진실 원천(SSOT)입니다.
 */
export const PERMISSION_REGISTRY: readonly PermissionDefinition[] = [
  {
    code: PermissionCode.POST_CREATE,
    bit: 1024,
    labelKo: "게시글 작성",
    labelEn: "Create Posts",
    description: "게시판 설정에서 역할에 연결된 게시판에 게시글을 작성할 수 있습니다.",
  },
  {
    code: PermissionCode.POST_OFFICIAL,
    bit: 2048,
    labelKo: "공식 명의 발행",
    labelEn: "Publish Officially",
    description: "게시글과 댓글을 공식 명의로 발행할 수 있습니다.",
  },
  {
    code: PermissionCode.POST_ANNOUNCEMENT,
    bit: 4096,
    labelKo: "공지·고정글 권한",
    labelEn: "Manage Announcements",
    description: "게시글을 공지로 표시하거나 게시판 상단에 고정할 수 있습니다.",
  },
  {
    code: PermissionCode.VIEW_SECRET_POST,
    bit: 8192,
    labelKo: "비밀글 열람",
    labelEn: "View Secret Posts",
    description: "비밀글 내용을 열람할 수 있습니다. 익명 작성자의 신원은 공개하지 않습니다.",
  },
  {
    code: PermissionCode.COMMENT_CREATE,
    bit: 16384,
    labelKo: "댓글 작성",
    labelEn: "Create Comments",
    description: "댓글 작성이 허용된 게시글에 댓글을 작성할 수 있습니다.",
  },
  {
    code: PermissionCode.MODERATE_POST_COMMENT,
    bit: 32768,
    labelKo: "게시글·댓글 관리·제재",
    labelEn: "Moderate Posts and Comments",
    description:
      "게시글과 댓글을 수정·삭제·숨김 처리하고 작성자 이용 제한을 적용할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_SUGGESTION_REPLY,
    bit: 65536,
    labelKo: "공식 답변 관리",
    labelEn: "Manage Official Replies",
    description: "공식 답변이 허용된 게시판에서 공식 답변을 작성할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_BOARD_SETTINGS,
    bit: 131072,
    labelKo: "게시판 설정 관리",
    labelEn: "Manage Board Settings",
    description: "게시판을 만들고 작성 역할 매핑과 게시판 기능을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_PERMISSIONS,
    bit: 262144,
    labelKo: "권한 관리",
    labelEn: "Manage Permissions",
    description: "역할 그룹과 역할별 권한·구성원을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_FINANCE,
    bit: 524288,
    labelKo: "과비 관리",
    labelEn: "Manage Finance",
    description: "학생회비 납부 상태와 수납 내역을 확인·수정하고 원장과 동기화할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_SITE_CONTENT,
    bit: 1048576,
    labelKo: "사이트 콘텐츠 관리",
    labelEn: "Manage Site Content",
    description: "홈 화면과 배너, 소개 콘텐츠를 수정할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_POLL,
    bit: 2097152,
    labelKo: "투표 관리",
    labelEn: "Manage Polls",
    description: "투표를 만들고 투표 결과를 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.VIEW_USERS,
    bit: 4194304,
    labelKo: "유저 DB 열람",
    labelEn: "View User Database",
    description: "사용자 목록과 사용자 프로필을 열람할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_USERS,
    bit: 8388608,
    labelKo: "유저 DB 관리",
    labelEn: "Manage User Database",
    description: "사용자 계정의 활성 상태와 운영 정보를 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.VIEW_CONTACTS,
    bit: 16777216,
    labelKo: "집행위 연락망 열람",
    labelEn: "View Executive Contacts",
    description: "집행위원회 연락망을 열람할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_CONTACTS,
    bit: 33554432,
    labelKo: "집행위 연락망 관리",
    labelEn: "Manage Executive Contacts",
    description: "집행위원회 연락망을 등록·수정·삭제할 수 있습니다.",
  },
  {
    code: PermissionCode.SEND_EMAIL,
    bit: 67108864,
    labelKo: "메일 발송",
    labelEn: "Send Email",
    description: "승인된 수신자에게 운영 메일을 작성하고 발송할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_SURVEY,
    bit: 134217728,
    labelKo: "설문조사 관리",
    labelEn: "Manage Surveys",
    description: "투표를 제외한 설문·신청·행사형 콘텐츠와 응답을 관리할 수 있습니다.",
  },
  {
    code: PermissionCode.MANAGE_CALENDAR,
    bit: 268435456,
    labelKo: "캘린더 일정 관리",
    labelEn: "Manage Calendar",
    description: "캘린더 일정을 등록·수정·삭제할 수 있습니다.",
  },
  {
    code: PermissionCode.VIEW_AUDIT_LOG,
    bit: 536870912,
    labelKo: "운영 로그 열람",
    labelEn: "View Audit Logs",
    description: "운영 변경 이력과 감사 로그를 열람할 수 있습니다.",
  },
  {
    code: PermissionCode.SUPER_ADMIN,
    bit: 1073741824,
    labelKo: "시스템 관리자",
    labelEn: "Super Admin",
    description: "부트스트랩과 장애 대응을 위한 시스템 전용 권한입니다.",
    isSystemOnly: true,
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
 * Permissions.has(userMask, Permissions.SUPER_ADMIN);
 *
 * // code 문자열로 체크
 * Permissions.hasCode(userMask, PermissionCode.SUPER_ADMIN);
 *
 * // 복수 체크 (AND — 모두 만족해야 함)
 * Permissions.has(userMask, Permissions.POST_CREATE, Permissions.MODERATE_POST_COMMENT);
 *
 * // 하나라도 만족하면 OK (OR)
 * Permissions.hasAny(userMask, Permissions.SUPER_ADMIN, Permissions.MODERATE_POST_COMMENT);
 *
 * // 권한 부여/해제
 * const newMask = Permissions.grant(mask, Permissions.POST_CREATE);
 * const revoked = Permissions.revoke(mask, Permissions.SUPER_ADMIN);
 * ```
 */
export const Permissions = {
  // ── Bit value constants (convenience) ──────────────────────────────────
  POST_CREATE: 1024,
  POST_OFFICIAL: 2048,
  POST_ANNOUNCEMENT: 4096,
  VIEW_SECRET_POST: 8192,
  COMMENT_CREATE: 16384,
  MODERATE_POST_COMMENT: 32768,
  MANAGE_SUGGESTION_REPLY: 65536,
  MANAGE_BOARD_SETTINGS: 131072,
  MANAGE_PERMISSIONS: 262144,
  MANAGE_FINANCE: 524288,
  MANAGE_SITE_CONTENT: 1048576,
  MANAGE_POLL: 2097152,
  VIEW_USERS: 4194304,
  MANAGE_USERS: 8388608,
  VIEW_CONTACTS: 16777216,
  MANAGE_CONTACTS: 33554432,
  SEND_EMAIL: 67108864,
  MANAGE_SURVEY: 134217728,
  MANAGE_CALENDAR: 268435456,
  VIEW_AUDIT_LOG: 536870912,
  SUPER_ADMIN: 1073741824,

  // Deprecated source-compatible aliases. They are intentionally absent from
  // PERMISSION_REGISTRY and cannot be assigned as separate permissions.
  WRITE_NOTICE: 4096,
  WRITE_GENERAL: 1024,
  WRITE_REPLY: 65536,
  MANAGE_CONTENT: 1048576,
  MANAGE_TOOL: 0,
  MODERATOR: 32768,
  ADMIN: 1073741824,
  EXECUTIVE: 2048,

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
