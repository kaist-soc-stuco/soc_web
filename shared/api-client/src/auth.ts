import type {
  ConsentDecisionRequest,
  ConsentDecisionResponse,
  ChannelTalkConfigResponse,
  CsrfTokenResponse,
  CurrentUserResponse,
  LoginSessionResponse,
  LoginStartResponse,
  LogoutResponse,
  RefreshResponse,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export interface LoginResultResponse {
  storageMode: "persisted" | "temporary";
  userId?: string;
}

export const createAuthApi = ({ authBaseUrl, requestJson }: ApiClientContext) => ({
  getCsrfToken: async (): Promise<CsrfTokenResponse> => {
    return requestJson<CsrfTokenResponse>(`${authBaseUrl}/csrf`, {
      method: "GET",
    });
  },

  getLoginStartPayload: async (): Promise<LoginStartResponse> => {
    return requestJson<LoginStartResponse>(`${authBaseUrl}/login/start`, {
      method: "GET",
    });
  },

  getChannelTalkConfig: async (): Promise<ChannelTalkConfigResponse> => {
    return requestJson<ChannelTalkConfigResponse>(`${authBaseUrl}/channel-talk`, {
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
    const { csrfToken } = await requestJson<CsrfTokenResponse>(
      `${authBaseUrl}/csrf`,
      { method: "GET" },
    );
    return requestJson<ConsentDecisionResponse>(
      `${authBaseUrl}/login/consent`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        method: "POST",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  consumeLoginResult: async (): Promise<LoginResultResponse> => {
    const { csrfToken } = await requestJson<CsrfTokenResponse>(
      `${authBaseUrl}/csrf`,
      { method: "GET" },
    );
    return requestJson<LoginResultResponse>(
      `${authBaseUrl}/login/result`,
      {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        method: "POST",
      },
    );
  },

  refreshSession: async (): Promise<RefreshResponse> => {
    return requestJson<RefreshResponse>(`${authBaseUrl}/refresh`, {
      body: JSON.stringify({}),
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

});
