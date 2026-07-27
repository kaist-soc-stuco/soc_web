import type {
  ConsentDecisionRequest,
  HealthResponse,
  LoginSessionResponse,
  LoginStartResponse,
} from "@soc/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export class ApiClientHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "ApiClientHttpError";
  }
}

const withNoTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

const resolveAuthBaseUrl = (normalizedBaseUrl: string): string => {
  if (/\/api\/v1$/i.test(normalizedBaseUrl) || /\/v1$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/auth`;
  }

  if (/\/api$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/auth`;
  }

  return `${normalizedBaseUrl}/v1/auth`;
};
const resolveHealthUrl = (normalizedBaseUrl: string): string => {
  if (normalizedBaseUrl.startsWith("/")) {
    return "/health/ready";
  }

  try {
    return new URL("/health/ready", normalizedBaseUrl).toString();
  } catch {
    return `${normalizedBaseUrl}/health/ready`;
  }
};


const readError = async (response: Response): Promise<ApiClientHttpError> => {
  let code: string | undefined;
  let requestId: string | undefined;

  try {
    const envelope: unknown = await response.json();
    if (typeof envelope === "object" && envelope !== null) {
      const value = envelope as { code?: unknown; message?: unknown; requestId?: unknown };
      if (
        typeof value.code === "string" &&
        typeof value.message === "string" &&
        typeof value.requestId === "string"
      ) {
        code = value.code;
        requestId = value.requestId;
      }
    }
  } catch {
    // Malformed or empty error responses have no safe metadata to retain.
  }

  return new ApiClientHttpError(response.status, code, requestId);
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<T>;
};

const expectNoContent = async (response: Response): Promise<void> => {
  if (response.status !== 204) {
    throw await readError(response);
  }
};

export const createApiClient = ({
  baseUrl,
  fetcher = fetch,
}: ApiClientOptions) => {
  const normalizedBaseUrl = withNoTrailingSlash(baseUrl);
  const authBaseUrl = resolveAuthBaseUrl(normalizedBaseUrl);
  let refreshInFlight: Promise<void> | null = null;

  const request = (url: string, init: RequestInit): Promise<Response> =>
    fetcher(url, { credentials: "include", ...init });

  const refreshSession = async (): Promise<void> => {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        let response = await request(`${authBaseUrl}/refresh`, { method: "POST" });

        if (response.status === 409) {
          response = await request(`${authBaseUrl}/refresh`, { method: "POST" });
        }

        await expectNoContent(response);
      })();
    }

    try {
      await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  };

  const requestJson = async <T>(url: string, init: RequestInit): Promise<T> =>
    readJson<T>(await request(url, init));

  return {
    getLoginStartPayload: async (): Promise<LoginStartResponse> =>
      requestJson<LoginStartResponse>(`${authBaseUrl}/login/start`, { method: "GET" }),
    getSession: async (): Promise<LoginSessionResponse> =>
      requestJson<LoginSessionResponse>(`${authBaseUrl}/session`, { method: "GET" }),

    submitConsentDecision: async (input: ConsentDecisionRequest): Promise<void> => {
      const response = await request(`${authBaseUrl}/login/consent`, {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await expectNoContent(response);
    },

    refreshSession,

    logout: async (): Promise<void> => {
      const response = await request(`${authBaseUrl}/logout`, { method: "POST" });
      await expectNoContent(response);
    },

    getHealth: async (): Promise<HealthResponse> =>
      requestJson<HealthResponse>(resolveHealthUrl(normalizedBaseUrl), { method: "GET" }),
  };
};
