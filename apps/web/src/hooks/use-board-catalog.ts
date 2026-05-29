import { useEffect, useMemo, useState } from "react";

import {
  getFallbackBoards,
  type BoardMetadata,
} from "@/lib/board-metadata";

interface BoardCatalogApiClient {
  getBoards: () => Promise<{ items: BoardMetadata[] }>;
}

export function useBoardCatalog(apiClient: BoardCatalogApiClient) {
  const fallbackBoards = useMemo(() => getFallbackBoards(), []);
  const [boards, setBoards] = useState<BoardMetadata[]>(fallbackBoards);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    apiClient
      .getBoards()
      .then((response) => {
        if (!cancelled && response.items.length > 0) {
          setBoards(response.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoards(fallbackBoards);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, fallbackBoards]);

  const boardByCode = useMemo(
    () => new Map(boards.map((board) => [board.code, board])),
    [boards],
  );

  return {
    boards,
    boardByCode,
    isLoading,
  };
}
