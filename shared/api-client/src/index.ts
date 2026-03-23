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

  return {
    /**
     * TODO:
     * - `/v1/auth/login/start` 실제 경로와 인증 정책을 backend 구현과 맞추세요.
     * - `credentials: 'include'`가 필요한지 검토하세요.
     */
    getLoginStartPayload: async (): Promise<LoginStartResponse> => {
      throw new Error("TODO: getLoginStartPayload 구현");
    },

    /**
     * TODO:
     * - 현재 로그인 세션 상태를 조회하는 메서드로 채우세요.
     */
    getSession: async (): Promise<LoginSessionResponse> => {
      throw new Error("TODO: getSession 구현");
    },

    /**
     * TODO:
     * - 개인정보 저장 동의/비동의를 backend consent endpoint와 연결하세요.
     */
    submitConsentDecision: async (
      _input: ConsentDecisionRequest,
    ): Promise<ConsentDecisionResponse> => {
      throw new Error("TODO: submitConsentDecision 구현");
    },

    /**
     * TODO:
     * - access token 만료 시 refresh token rotation과 연결하세요.
     */
    refreshSession: async (): Promise<RefreshResponse> => {
      throw new Error("TODO: refreshSession 구현");
    },

    /**
     * TODO:
     * - logout 시 cookie/sessionStorage/Redis revoke가 함께 되도록 연결하세요.
     */
    logout: async (): Promise<LogoutResponse> => {
      throw new Error("TODO: logout 구현");
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
