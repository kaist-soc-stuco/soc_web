import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getFallbackBoards,
  type BoardMetadata,
} from "@/lib/board-metadata";

interface BoardCatalogApiClient {
  getBoards: () => Promise<{ items: BoardMetadata[] }>;
}

type BoardCatalogSource = "fallback" | "loading" | "server";

const SERVER_CACHE_MS = 5 * 60 * 1000;
const FALLBACK_CACHE_MS = 30 * 1000;

export function useBoardCatalog(apiClient: BoardCatalogApiClient) {
  const fallbackBoards = useMemo(() => getFallbackBoards(), []);
  const catalogQuery = useQuery({
    queryKey: ["board-catalog"],
    queryFn: async () => {
      try {
        const response = await apiClient.getBoards();
        return {
          // QnA는 legacy deep-link만 보존하고 신규 공개 탐색·작성 경로에서는 Channel Talk으로 대체합니다.
          boards: response.items.filter((board) => board.code !== "QnA"),
          source: "server" as const,
        };
      } catch {
        return {
          boards: fallbackBoards.filter((board) => board.code !== "QnA"),
          source: "fallback" as const,
        };
      }
    },
    staleTime: (query) =>
      query.state.data?.source === "fallback"
        ? FALLBACK_CACHE_MS
        : SERVER_CACHE_MS,
  });

  const boards = catalogQuery.data?.boards ?? [];
  const source: BoardCatalogSource =
    catalogQuery.data?.source ?? (catalogQuery.isPending ? "loading" : "fallback");

  const boardByCode = useMemo(
    () => new Map(boards.map((board) => [board.code, board])),
    [boards],
  );

  return {
    boards,
    boardByCode,
    isLoading: catalogQuery.isPending,
    source,
  };
}
