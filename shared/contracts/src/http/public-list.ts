import { z } from "zod";

export const PublicListFiltersSchema = z.object({
  state: z.enum(["all", "active", "before_open", "open", "closed", "always"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  eventOrder: z.enum(["date"]).optional(),
});
export type PublicListFilters = z.infer<typeof PublicListFiltersSchema>;
export type PublicListStateCounts = Record<"all" | "active" | "before_open" | "open" | "closed", number> & { always?: number };
