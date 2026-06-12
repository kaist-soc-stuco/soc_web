import type { GreetingResponse, HealthResponse } from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createMiscApi = ({
  normalizedBaseUrl,
  requestJson,
}: ApiClientContext) => ({
  getHealth: async (): Promise<HealthResponse> => {
    return requestJson<HealthResponse>(`${normalizedBaseUrl}/health`, {
      method: "GET",
    });
  },

  getGreeting: async (): Promise<GreetingResponse> => {
    return requestJson<GreetingResponse>(
      `${normalizedBaseUrl}/v1/mock/greeting`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },
});
