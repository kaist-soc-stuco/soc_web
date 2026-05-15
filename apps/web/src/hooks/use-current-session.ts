import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getAuthSessionSummary } from "@/lib/auth-session";

const SESSION_STALE_TIME_MS = 5 * 60 * 1000;

export const useCurrentSession = () => {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => getAuthSessionSummary(apiClient),
    staleTime: SESSION_STALE_TIME_MS,
  });
};
