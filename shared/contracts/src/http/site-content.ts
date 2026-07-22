import type { z } from "zod";

import type {
  SiteContentKeySchema,
  UpsertSiteContentSchema,
} from "../schemas.js";

export type SiteContentKey = z.infer<typeof SiteContentKeySchema>;

export type UpsertSiteContentRequest = z.infer<
  typeof UpsertSiteContentSchema
>;

/** Public representation. Internal editor identifiers are intentionally absent. */
export interface PublicSiteContentRecord {
  key: SiteContentKey;
  updatedAt: string;
  valueEn: string;
  valueKo: string;
}

export interface SiteContentRecord extends PublicSiteContentRecord {
  createdAt: string;
  updatedBy: string | null;
}

export interface SiteContentListResponse {
  items: PublicSiteContentRecord[];
}

export interface AdminSiteContentListResponse {
  items: SiteContentRecord[];
}
