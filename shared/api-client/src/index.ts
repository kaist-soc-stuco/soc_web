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

const resolveAuthBaseUrl = (normalizedBaseUrl: string): string => {
  if (/\/api\/v1$/i.test(normalizedBaseUrl) || /\/v1$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/auth`;
  }

  if (/\/api$/i.test(normalizedBaseUrl)) {
    // Reverse proxy usually maps /api/* -> backend /v1/*
    return `${normalizedBaseUrl}/auth`;
  }

  return `${normalizedBaseUrl}/v1/auth`;
};

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
  const authBaseUrl = resolveAuthBaseUrl(normalizedBaseUrl);

  return {
    getLoginStartPayload: async (): Promise<LoginStartResponse> => {
      const response = await fetcher(`${authBaseUrl}/login/start`, {
        credentials: "include",
        method: "GET",
      });

      return readJson<LoginStartResponse>(response);
    },

    getSession: async (sessionId?: string): Promise<LoginSessionResponse> => {
      const query = sessionId
        ? `?sessionId=${encodeURIComponent(sessionId)}`
        : "";
      const response = await fetcher(`${authBaseUrl}/session${query}`, {
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
      const response = await fetcher(
        `${authBaseUrl}/login/result?resultToken=${encodeURIComponent(resultToken)}`,
        {
        credentials: "include",
        method: "GET",
        },
      );

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
