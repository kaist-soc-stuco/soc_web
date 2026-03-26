import type {
  ConsentDecisionRequest,
  ConsentDecisionResponse,
  GreetingResponse,
  HealthResponse,
  LoginSessionResponse,
  LoginStartResponse,
  LogoutResponse,
  RefreshResponse,
} from "@soc/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

interface LoginResultResponse {
  storageMode: "persisted" | "temporary";
  userId?: string;
}

const withNoTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const createApiClient = ({
  baseUrl,
  fetcher = fetch,
}: ApiClientOptions) => {
  const normalizedBaseUrl = withNoTrailingSlash(baseUrl);
  const authBaseUrl = `${normalizedBaseUrl}/v1/auth`;

  return {
    getLoginStartPayload: async (): Promise<LoginStartResponse> => {
      const response = await fetcher(`${authBaseUrl}/login/start`, {
        credentials: "include",
        method: "GET",
      });

      return readJson<LoginStartResponse>(response);
    },

    getSession: async (sessionId?: string): Promise<LoginSessionResponse> => {
      const endpoint = new URL(`${authBaseUrl}/session`, "http://localhost");

      if (sessionId) {
        endpoint.searchParams.set("sessionId", sessionId);
      }

      const pathWithQuery = `${endpoint.pathname}${endpoint.search}`;

      const response = await fetcher(`${normalizedBaseUrl}${pathWithQuery}`, {
        credentials: "include",
        method: "GET",
      });

      return readJson<LoginSessionResponse>(response);
    },

    submitConsentDecision: async (
      input: ConsentDecisionRequest,
    ): Promise<ConsentDecisionResponse> => {
      const response = await fetcher(`${authBaseUrl}/login/consent`, {
        body: JSON.stringify(input),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      return readJson<ConsentDecisionResponse>(response);
    },

    consumeLoginResult: async (resultToken: string): Promise<LoginResultResponse> => {
      const endpoint = new URL(`${authBaseUrl}/login/result`, "http://localhost");
      endpoint.searchParams.set("resultToken", resultToken);
      const pathWithQuery = `${endpoint.pathname}${endpoint.search}`;

      const response = await fetcher(`${normalizedBaseUrl}${pathWithQuery}`, {
        credentials: "include",
        method: "GET",
      });

      return readJson<LoginResultResponse>(response);
    },

    refreshSession: async (): Promise<RefreshResponse> => {
      const response = await fetcher(`${authBaseUrl}/refresh`, {
        body: JSON.stringify({}),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      return readJson<RefreshResponse>(response);
    },

    logout: async (): Promise<LogoutResponse> => {
      const response = await fetcher(`${authBaseUrl}/logout`, {
        body: JSON.stringify({}),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      return readJson<LogoutResponse>(response);
    },

    getHealth: async (): Promise<HealthResponse> => {
      const response = await fetcher(`${normalizedBaseUrl}/health`);
      return readJson<HealthResponse>(response);
    },

    getGreeting: async (): Promise<GreetingResponse> => {
      const response = await fetcher(`${normalizedBaseUrl}/v1/mock/greeting`);
      return readJson<GreetingResponse>(response);
    },
  };
};
