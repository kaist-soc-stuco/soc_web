import { useEffect, useMemo, useState } from "react";

import {
  getFallbackBoards,
  type BoardMetadata,
} from "@/lib/board-metadata";

interface BoardCatalogApiClient {
  getBoards: () => Promise<{ items: BoardMetadata[] }>;
}

type BoardCatalogSource = "fallback" | "loading" | "server";

export function useBoardCatalog(apiClient: BoardCatalogApiClient) {
  const fallbackBoards = useMemo(() => getFallbackBoards(), []);
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<BoardCatalogSource>("loading");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSource("loading");

    apiClient
      .getBoards()
      .then((response) => {
        if (!cancelled) {
          setBoards(response.items);
          setSource("server");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoards(fallbackBoards);
          setSource("fallback");
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
    source,
  };
}
