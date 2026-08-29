import { createApiClient } from "@soc/api-client";
import type { ContactDepartmentRecord } from "@soc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { resolveApiBaseUrl } from "@/lib/api-base-url";

export const PUBLIC_CONTACT_DEPARTMENTS_QUERY_KEY = ["contacts", "departments", "public"] as const;

export function usePublicContactDepartments(): {
  departments: ContactDepartmentRecord[];
  isLoading: boolean;
} {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const query = useQuery({
    queryKey: PUBLIC_CONTACT_DEPARTMENTS_QUERY_KEY,
    queryFn: () => apiClient.getContactDepartments(),
    staleTime: 60 * 1000,
  });

  return {
    departments: query.data?.items ?? [],
    isLoading: query.isLoading,
  };
}
