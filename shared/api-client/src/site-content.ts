import type {
  AdminSiteContentListResponse,
  SiteContentKey,
  SiteContentListResponse,
  SiteContentRecord,
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
});
