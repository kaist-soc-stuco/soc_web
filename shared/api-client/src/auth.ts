import type {
  ConsentDecisionRequest,
  ConsentDecisionResponse,
  CurrentUserResponse,
  LoginSessionResponse,
  LoginStartResponse,
  LogoutResponse,
  RefreshResponse,
} from "@soc/contracts";

import type { ApiClientContext } from "./core";

interface LoginResultResponse {
  storageMode: "persisted" | "temporary";
  userId?: string;
}

interface MockLoginResponse {
  storageMode: "persisted";
  userId: string;
}

interface AccessCheckResponse {
  mode: "persisted" | "temporary";
  ok: boolean;
}

interface TemporaryAuthRequest {
  refreshToken?: string;
  sessionId?: string;
}

export const createAuthApi = ({ authBaseUrl, requestJson }: ApiClientContext) => ({
  getLoginStartPayload: async (): Promise<LoginStartResponse> => {
    return requestJson<LoginStartResponse>(`${authBaseUrl}/login/start`, {
      method: "GET",
    });
  },

  getSession: async (sessionId?: string): Promise<LoginSessionResponse> => {
    const query = sessionId
      ? `?sessionId=${encodeURIComponent(sessionId)}`
      : "";
    return requestJson<LoginSessionResponse>(
      `${authBaseUrl}/session${query}`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  checkAccessToken: async (): Promise<AccessCheckResponse> => {
    return requestJson<AccessCheckResponse>(
      `${authBaseUrl}/access-check`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  getCurrentUser: async (): Promise<CurrentUserResponse> => {
    return requestJson<CurrentUserResponse>(
      `${authBaseUrl}/me`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  submitConsentDecision: async (
    input: ConsentDecisionRequest,
  ): Promise<ConsentDecisionResponse> => {
    return requestJson<ConsentDecisionResponse>(
      `${authBaseUrl}/login/consent`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  consumeLoginResult: async (
    resultToken: string,
  ): Promise<LoginResultResponse> => {
    return requestJson<LoginResultResponse>(
      `${authBaseUrl}/login/result?resultToken=${encodeURIComponent(resultToken)}`,
      {
        method: "GET",
      },
    );
  },

  refreshSession: async (
    temporaryAuth?: TemporaryAuthRequest,
  ): Promise<RefreshResponse> => {
    return requestJson<RefreshResponse>(`${authBaseUrl}/refresh`, {
      body: JSON.stringify(temporaryAuth ?? {}),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  },

  logout: async (input?: { sessionId?: string }): Promise<LogoutResponse> => {
    return requestJson<LogoutResponse>(`${authBaseUrl}/logout`, {
      body: JSON.stringify(input ?? {}),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  },

  loginWithMockSession: async (): Promise<MockLoginResponse> => {
    return requestJson<MockLoginResponse>(
      `${authBaseUrl}/login/mock`,
      {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },
});
