import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getAuthSessionSummary } from "@/lib/auth-session";

// Permissions can be granted or revoked in another browser while a user is
// signed in. Keep the snapshot short; AuthGuard also forces one fresh check
// before redirecting a user who currently lacks the requested permission.
const SESSION_STALE_TIME_MS = 30 * 1000;

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
