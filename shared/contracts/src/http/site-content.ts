import type { z } from "zod";

import type {
  ContentBlockStatusSchema,
  ContentBlockTypeSchema,
  CreateContentBlockSchema,
  ReorderContentBlocksSchema,
  SiteContentKeySchema,
  UpdateContentBlockSchema,
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

export type ContentBlockType = z.infer<typeof ContentBlockTypeSchema>;
export type ContentBlockStatus = z.infer<typeof ContentBlockStatusSchema>;
export type CreateContentBlockRequest = z.infer<typeof CreateContentBlockSchema>;
export type UpdateContentBlockRequest = z.infer<typeof UpdateContentBlockSchema>;
export type ReorderContentBlocksRequest = z.infer<typeof ReorderContentBlocksSchema>;

export interface ContentBlockRecord {
  contentBlockId: string;
  type: ContentBlockType;
  status: ContentBlockStatus;
  titleKo: string;
  titleEn: string;
  bodyKo: string | null;
  bodyEn: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  imageUrlEn: string | null;
  pledgeStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | null;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlockListResponse {
  items: ContentBlockRecord[];
}
