import type { UseQueryOptions } from "@tanstack/react-query";

export function scopedListQueryOptions<T>({
  identity,
  permission,
  resource,
  params = null,
  queryFn,
}: {
  identity: string | undefined;
  permission: number | undefined;
  resource: string;
  params?: unknown;
  queryFn: () => Promise<T>;
}): UseQueryOptions<T, Error, T> & { queryKey: readonly unknown[] } {
  return {
    queryKey: ["admin-list", identity, permission, resource, params] as const,
    queryFn,
    staleTime: 0,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === identity &&
      previousQuery?.queryKey[2] === permission &&
      previousQuery?.queryKey[3] === resource
        ? previous
        : undefined,
  };
}
