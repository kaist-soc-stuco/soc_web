import { BadRequestException } from "@nestjs/common";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { isoToDate } from "@soc/shared";
import { PublicListFiltersSchema, type PublicListFilters } from "@soc/contracts";

export function parsePublicListFilters(input: PublicListFilters): PublicListFilters {
  const result = PublicListFiltersSchema.safeParse(input);
  if (!result.success) throw new BadRequestException("invalid_public_list_filters");
  return result.data;
}

export const publicListStateFields = (state: SQL) => ({
  all: sql<number>`count(*)::int`,
  before_open: sql<number>`count(*) FILTER (WHERE ${state} = 'before_open')::int`,
  open: sql<number>`count(*) FILTER (WHERE ${state} = 'open')::int`,
  closed: sql<number>`count(*) FILTER (WHERE ${state} = 'closed')::int`,
});

export function publicListDateFilter(start: SQL, end: SQL, filters: PublicListFilters) {
  return and(
    filters.from || filters.to ? sql`${start} IS NOT NULL` : undefined,
    filters.from ? sql`coalesce(${end}, ${start}) >= ${isoToDate(`${filters.from}T00:00:00+09:00`)}` : undefined,
    filters.to ? sql`${start} <= ${isoToDate(`${filters.to}T23:59:59.999+09:00`)}` : undefined,
    filters.from && filters.to && filters.from > filters.to ? sql`false` : undefined,
  );
}

export const publicListStateFilter = (state: SQL, filters: PublicListFilters) =>
  filters.state && filters.state !== "all" ? eq(state, filters.state) : undefined;

export const publicListStateRank = (state: SQL) =>
  sql`CASE ${state} WHEN 'open' THEN 0 WHEN 'before_open' THEN 1 ELSE 2 END`;
