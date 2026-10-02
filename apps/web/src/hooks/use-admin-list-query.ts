import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";

import { useCurrentSession } from "@/hooks/use-current-session";
import { scopedListQueryOptions } from "@/lib/list-query-options";

/** Keep cached rows across navigation and retain the current list during filtering.
 * Identity and permissions belong in the key so another session cannot inherit rows.
 */
export function useAdminListQuery<T>({
  resource,
  params = null,
  queryFn,
  enabled = true,
}: {
  resource: string;
  params?: unknown;
  queryFn: () => Promise<T>;
  enabled?: boolean;
}) {
  const { data: session, isPending } = useCurrentSession();
  const identity = session?.userId;
  const permission = session?.permission;
  const queryClient = useQueryClient();
  const options = scopedListQueryOptions({ identity, permission, resource, params, queryFn });
  const result = useQuery<T, Error>({
    ...options,
    enabled: enabled && !isPending && !!identity && !!session?.authenticated,
  });
  const setData = (update: SetStateAction<T>) => {
    void queryClient.cancelQueries({ queryKey: options.queryKey, exact: true });
    queryClient.setQueryData<T>(options.queryKey, current =>
      typeof update === "function"
        ? current === undefined ? current : (update as (value: T) => T)(current)
        : update,
    );
  };
  return { ...result, setData };
}
