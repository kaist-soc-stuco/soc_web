import { z } from "zod";

export const PublicListFiltersSchema = z.object({
  state: z.enum(["all", "before_open", "open", "closed"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type PublicListFilters = z.infer<typeof PublicListFiltersSchema>;
export type PublicListStateCounts = Record<"all" | "before_open" | "open" | "closed", number>;
