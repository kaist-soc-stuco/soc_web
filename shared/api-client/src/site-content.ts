import type {
  AdminSiteContentListResponse,
  ContentBlockListResponse,
  ContentBlockRecord,
  CreateContentBlockRequest,
  ReorderContentBlocksRequest,
  SiteContentKey,
  SiteContentListResponse,
  SiteContentRecord,
  UpdateContentBlockRequest,
  UpsertSiteContentRequest,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createSiteContentApi = ({
  requestJson,
  requestVoid,
  siteContentBaseUrl,
}: ApiClientContext) => ({
  getSiteContent: async (): Promise<SiteContentListResponse> => {
    return requestJson<SiteContentListResponse>(siteContentBaseUrl, {
      method: "GET",
    });
  },

  getAdminSiteContent: async (): Promise<AdminSiteContentListResponse> => {
    return requestJson<AdminSiteContentListResponse>(
      `${siteContentBaseUrl}/admin`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  upsertSiteContent: async (
    key: SiteContentKey,
    body: UpsertSiteContentRequest,
  ): Promise<SiteContentRecord> => {
    return requestJson<SiteContentRecord>(
      `${siteContentBaseUrl}/${encodeURIComponent(key)}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteSiteContent: async (key: SiteContentKey): Promise<void> => {
    await requestVoid(
      `${siteContentBaseUrl}/${encodeURIComponent(key)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  listAdminContentBlocks: async (): Promise<ContentBlockListResponse> => {
    return requestJson<ContentBlockListResponse>(
      `${siteContentBaseUrl}/blocks/admin`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  listPublicContentBlocks: async (): Promise<ContentBlockListResponse> => {
    return requestJson<ContentBlockListResponse>(`${siteContentBaseUrl}/blocks/public`, {
      method: "GET",
    });
  },

  createContentBlock: async (body: CreateContentBlockRequest): Promise<ContentBlockRecord> => {
    return requestJson<ContentBlockRecord>(
      `${siteContentBaseUrl}/blocks`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateContentBlock: async (
    contentBlockId: string,
    body: UpdateContentBlockRequest,
  ): Promise<ContentBlockRecord> => {
    return requestJson<ContentBlockRecord>(
      `${siteContentBaseUrl}/blocks/${encodeURIComponent(contentBlockId)}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  reorderContentBlocks: async (body: ReorderContentBlocksRequest): Promise<ContentBlockListResponse> => {
    return requestJson<ContentBlockListResponse>(
      `${siteContentBaseUrl}/blocks/reorder`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  publishContentBlock: async (contentBlockId: string): Promise<ContentBlockRecord> => {
    return requestJson<ContentBlockRecord>(
      `${siteContentBaseUrl}/blocks/${encodeURIComponent(contentBlockId)}/publish`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  deleteContentBlock: async (contentBlockId: string): Promise<void> => {
    await requestVoid(
      `${siteContentBaseUrl}/blocks/${encodeURIComponent(contentBlockId)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },
});
