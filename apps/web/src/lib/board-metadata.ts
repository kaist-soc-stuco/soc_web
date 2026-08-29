import {
  normalizeBoardCode,
  Permissions,
  type BoardSummary,
  type BoardWriteAccessScope,
} from "@soc/contracts";

export const BOARD_CODES = [
  "notice",
  "hoc",
  "promotions",
  "suggestions",
  "labs",
  "faq",
] as const;

// These boards remain addressable for legacy links and data, but they are not
// part of the current public board navigation. Events have their own landing
// page and pledges/legacy Q&A have dedicated replacement paths.
export const LEGACY_PUBLIC_BOARD_CODES = ["_EVENT", "행사", "공약", "QnA"] as const;

export const isLegacyPublicBoardCode = (code: string) =>
  LEGACY_PUBLIC_BOARD_CODES.includes(
    code as (typeof LEGACY_PUBLIC_BOARD_CODES)[number],
  );

export type BoardCode = (typeof BOARD_CODES)[number];

// 서버 카탈로그를 못 받은 상태에서는 fallback으로 글쓰기 권한을 열지 않는다.
const FALLBACK_WRITE_PERMISSION_BIT = Number.MAX_SAFE_INTEGER;

export interface BoardFallbackMetadata {
  descriptionEn: string;
  descriptionKo: string;
  labelEn: string;
  titleKo: string;
  writeAccessScope: BoardWriteAccessScope;
  writePermissionBit: number;
}

export type BoardMetadata = Pick<
  BoardSummary,
  | "allowComment"
  | "allowGuestRead"
  | "allowLike"
  | "allowSecret"
  | "code"
  | "descriptionEn"
  | "descriptionKo"
  | "nameEn"
  | "nameKo"
  | "writeAccessScope"
  | "writePermissionBit"
>;

const BOARD_FALLBACK_METADATA: Record<
  BoardCode,
  Omit<BoardFallbackMetadata, "writeAccessScope" | "writePermissionBit">
> = {
  notice: {
    descriptionKo: "전산학부의 다양한 소식을 확인하세요.",
    descriptionEn: "Get updates from the School of Computing.",
    labelEn: "Notice",
    titleKo: "공지",
  },
  hoc: {
    descriptionKo: "Hall of Code 프로젝트 및 활동 내역을 확인하세요.",
    descriptionEn: "Hall of Code projects and activity logs.",
    labelEn: "HoC",
    titleKo: "HoC",
  },
  promotions: {
    descriptionKo: "집행위원회 및 학회 홍보 게시물을 확인하세요.",
    descriptionEn: "Promotional posts from the SoC Student Council and societies.",
    labelEn: "Promotional Posts",
    titleKo: "홍보글",
  },
  suggestions: {
    descriptionKo: "학생들의 의견과 건의사항을 공유하는 공간입니다.",
    descriptionEn: "Share opinions and suggestions with the council.",
    labelEn: "Suggestions",
    titleKo: "건의사항",
  },
  labs: {
    descriptionKo: "각 연구실의 소식과 공지사항을 확인하세요.",
    descriptionEn: "News and announcements from research labs.",
    labelEn: "Research Labs",
    titleKo: "연구실",
  },
  faq: {
    descriptionKo: "FAQ와 답변을 확인하세요.",
    descriptionEn: "Browse frequently asked questions and answers.",
    labelEn: "FAQ",
    titleKo: "FAQ",
  },
};

export const getBoardFallbackMetadata = (
  code: string,
): BoardFallbackMetadata => {
  const canonicalCode = normalizeBoardCode(code);
  const metadata = BOARD_FALLBACK_METADATA[canonicalCode as BoardCode];
  if (metadata) {
    return {
      ...metadata,
      writeAccessScope: "PERMISSION",
      writePermissionBit: FALLBACK_WRITE_PERMISSION_BIT,
    };
  }

  return {
    descriptionKo: `${code} 게시판입니다.`,
    descriptionEn: `${code} board.`,
    labelEn: code,
    titleKo: code,
    writeAccessScope: "PERMISSION",
    writePermissionBit: FALLBACK_WRITE_PERMISSION_BIT,
  };
};

export const getBoardLabel = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? metadata.titleKo : metadata.labelEn;
};

export const getBoardTitle = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? metadata.titleKo : metadata.labelEn;
};

export const getBoardDescription = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? metadata.descriptionKo : metadata.descriptionEn;
};

export const getBoardWritePermissionBit = (code: string): number =>
  getBoardFallbackMetadata(code).writePermissionBit;

export const getFallbackBoards = (): BoardMetadata[] =>
  BOARD_CODES.map((code) => {
    const metadata = getBoardFallbackMetadata(code);
    return {
      code,
      nameKo: metadata.titleKo,
      nameEn: metadata.labelEn,
      descriptionKo: metadata.descriptionKo,
      descriptionEn: metadata.descriptionEn,
      allowComment: true,
      allowGuestRead: true,
      allowLike: true,
      allowSecret: code === "suggestions",
      writeAccessScope: metadata.writeAccessScope,
      writePermissionBit: metadata.writePermissionBit,
    };
  });

export const getBoardLabelFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
  lang: string,
): string => {
  const fallback = getBoardFallbackMetadata(code);
  if (!board) {
    return getBoardLabel(code, lang);
  }

  return lang === "ko"
    ? board.nameKo || code
    : board.nameEn || fallback.labelEn || board.nameKo || code;
};

export const getBoardTitleFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
  lang: string,
): string => {
  const fallback = getBoardFallbackMetadata(code);
  if (!board) {
    return getBoardTitle(code, lang);
  }

  if (lang === "ko") {
    return board.nameKo || code;
  }

  return board.nameEn || fallback.labelEn || board.nameKo || code;
};

export const getBoardDescriptionFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
  lang: string,
): string => {
  const fallback = getBoardFallbackMetadata(code);
  if (!board) {
    return getBoardDescription(code, lang);
  }

  return lang === "ko"
    ? board.descriptionKo || fallback.descriptionKo
    : board.descriptionEn || fallback.descriptionEn;
};

export const getBoardWritePermissionBitFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
): number => board?.writePermissionBit ?? getBoardWritePermissionBit(code);

export const getBoardWriteAccessScopeFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
): BoardWriteAccessScope => {
  if (board?.writeAccessScope) return board.writeAccessScope;
  return getBoardWritePermissionBitFromMetadata(board, code) > 0
    ? "PERMISSION"
    : "AUTHENTICATED";
};

type BoardWriteUserProfile = {
  permission: number;
  primaryMajor?: string | null;
  feeStatus?: "PAID" | "PARTIAL" | "UNPAID" | null;
};

const isSchoolOfComputingPrimaryMajor = (value?: string | null): boolean => {
  const normalized = (value ?? "").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
  return (
    normalized.includes("전산학부") ||
    normalized.includes("전산학과") ||
    normalized.includes("school of computing") ||
    normalized.includes("computer science")
  );
};

export const canWriteBoardFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
  user: BoardWriteUserProfile,
): boolean => {
  const scope = getBoardWriteAccessScopeFromMetadata(board, code);
  switch (scope) {
    case "ANYONE":
    case "AUTHENTICATED":
      return true;
    case "PERMISSION": {
      const requiredPermission = getBoardWritePermissionBitFromMetadata(board, code);
      return (
        requiredPermission > 0 &&
        requiredPermission !== FALLBACK_WRITE_PERMISSION_BIT &&
        Permissions.has(user.permission, requiredPermission)
      );
    }
    case "PRIMARY_MAJOR":
      return isSchoolOfComputingPrimaryMajor(user.primaryMajor);
    case "FEE_PAYER":
      return user.feeStatus === "PAID";
    default:
      return false;
  }
};
