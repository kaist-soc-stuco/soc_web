import type { BoardSummary } from "@soc/contracts";

export const BOARD_CODES = [
  "공지",
  "행사",
  "HoC",
  "홍보글",
  "건의사항",
  "연구실",
  "QnA",
] as const;

export type BoardCode = (typeof BOARD_CODES)[number];

// 서버 카탈로그를 못 받은 상태에서는 fallback으로 글쓰기 권한을 열지 않는다.
const FALLBACK_WRITE_PERMISSION_BIT = Number.MAX_SAFE_INTEGER;

export interface BoardFallbackMetadata {
  descriptionEn: string;
  descriptionKo: string;
  labelEn: string;
  titleKo: string;
  writePermissionBit: number;
}

export type BoardMetadata = Pick<
  BoardSummary,
  | "allowComment"
  | "code"
  | "description"
  | "nameEn"
  | "nameKo"
  | "writePermissionBit"
>;

const BOARD_FALLBACK_METADATA: Record<
  BoardCode,
  Omit<BoardFallbackMetadata, "writePermissionBit">
> = {
  공지: {
    descriptionKo: "전산학부의 다양한 소식을 확인하세요.",
    descriptionEn: "Get updates from the School of Computing.",
    labelEn: "Notice",
    titleKo: "공지",
  },
  행사: {
    descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요.",
    descriptionEn: "Discover events organized by the School of Computing.",
    labelEn: "Events",
    titleKo: "행사",
  },
  HoC: {
    descriptionKo: "Hall of Code 프로젝트 및 활동 내역을 확인하세요.",
    descriptionEn: "Hall of Code projects and activity logs.",
    labelEn: "HoC",
    titleKo: "HoC",
  },
  홍보글: {
    descriptionKo: "집행위원회 및 학회 홍보 게시물을 확인하세요.",
    descriptionEn: "Promotional posts from the Student Council and societies.",
    labelEn: "Promotions",
    titleKo: "홍보글",
  },
  건의사항: {
    descriptionKo: "학생들의 의견과 건의사항을 공유하는 공간입니다.",
    descriptionEn: "Share opinions and suggestions with the council.",
    labelEn: "Suggestions",
    titleKo: "건의사항",
  },
  연구실: {
    descriptionKo: "각 연구실의 소식과 공지사항을 확인하세요.",
    descriptionEn: "News and announcements from research labs.",
    labelEn: "Labs",
    titleKo: "연구실",
  },
  QnA: {
    descriptionKo: "궁금한 점을 자유롭게 질문하세요.",
    descriptionEn: "Ask questions and get answers freely.",
    labelEn: "Q&A",
    titleKo: "QnA",
  },
};

export const getBoardFallbackMetadata = (
  code: string,
): BoardFallbackMetadata => {
  const metadata = BOARD_FALLBACK_METADATA[code as BoardCode];
  if (metadata) {
    return {
      ...metadata,
      writePermissionBit: FALLBACK_WRITE_PERMISSION_BIT,
    };
  }

  return {
    descriptionKo: `${code} 게시판입니다.`,
    descriptionEn: `${code} board.`,
    labelEn: code,
    titleKo: code,
    writePermissionBit: FALLBACK_WRITE_PERMISSION_BIT,
  };
};

export const getBoardLabel = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? code : metadata.labelEn;
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
      nameKo: code,
      nameEn: metadata.labelEn,
      description: metadata.descriptionKo,
      allowComment: true,
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
    ? board.description || fallback.descriptionKo
    : fallback.descriptionEn;
};

export const getBoardWritePermissionBitFromMetadata = (
  board: BoardMetadata | null | undefined,
  code: string,
): number => board?.writePermissionBit ?? getBoardWritePermissionBit(code);
