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

export interface BoardFallbackMetadata {
  descriptionEn: string;
  descriptionKo: string;
  labelEn: string;
  titleKo: string;
  writePermissionBit: number;
}

export type BoardMetadata = Pick<
  BoardSummary,
  "code" | "nameKo" | "nameEn" | "description" | "writePermissionBit"
>;

const BOARD_FALLBACK_METADATA: Record<BoardCode, BoardFallbackMetadata> = {
  공지: {
    descriptionKo: "전산학부의 다양한 소식을 확인하세요.",
    descriptionEn: "Get updates on various news from KAIST School of Computing.",
    labelEn: "Notice",
    titleKo: "공지사항",
    writePermissionBit: 1,
  },
  행사: {
    descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요.",
    descriptionEn: "Discover events organized by the School of Computing.",
    labelEn: "Event",
    titleKo: "행사 게시판",
    writePermissionBit: 1,
  },
  HoC: {
    descriptionKo: "Hall of Code 프로젝트 및 활동 내역을 확인하세요.",
    descriptionEn: "Hall of Code projects and activity logs.",
    labelEn: "HoC",
    titleKo: "HoC 게시판",
    writePermissionBit: 2,
  },
  홍보글: {
    descriptionKo: "집행위원회 및 학회 홍보 게시물을 확인하세요.",
    descriptionEn: "Promotional posts from the Student Council and societies.",
    labelEn: "Promo",
    titleKo: "홍보글 게시판",
    writePermissionBit: 2,
  },
  건의사항: {
    descriptionKo: "학생들의 의견과 건의사항을 공유하는 공간입니다.",
    descriptionEn: "Share opinions and suggestions with us.",
    labelEn: "Suggestions",
    titleKo: "건의사항 게시판",
    writePermissionBit: 0,
  },
  연구실: {
    descriptionKo: "각 연구실의 소식과 공지사항을 확인하세요.",
    descriptionEn: "News and announcements from research labs.",
    labelEn: "Labs",
    titleKo: "연구실 게시판",
    writePermissionBit: 2,
  },
  QnA: {
    descriptionKo: "궁금한 점을 자유롭게 질문하세요.",
    descriptionEn: "Ask questions and get answers freely.",
    labelEn: "QnA",
    titleKo: "QnA 게시판",
    writePermissionBit: 0,
  },
};

export const getBoardFallbackMetadata = (
  code: string,
): BoardFallbackMetadata => {
  return (
    BOARD_FALLBACK_METADATA[code as BoardCode] ?? {
      descriptionKo: `${code} 게시판입니다.`,
      descriptionEn: `${code} board.`,
      labelEn: code,
      titleKo: `${code} 게시판`,
      writePermissionBit: 0,
    }
  );
};

export const getBoardLabel = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? code : metadata.labelEn;
};

export const getBoardTitle = (code: string, lang: string): string => {
  const metadata = getBoardFallbackMetadata(code);
  return lang === "ko" ? metadata.titleKo : `${metadata.labelEn} Board`;
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
    return code === "공지" ? "공지사항" : board.nameKo || fallback.titleKo;
  }

  return `${board.nameEn || fallback.labelEn || board.nameKo || code} Board`;
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
