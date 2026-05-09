import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDeleteResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  BoardListResponse,
  BoardSummary,
  ConsentDecisionRequest,
  ConsentDecisionResponse,
  CreateQuestionRequest,
  CreateSectionRequest,
  CreateSurveyRequest,
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentListResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
  CurrentUserResponse,
  GreetingResponse,
  HealthResponse,
  LoginSessionResponse,
  LoginStartResponse,
  LogoutResponse,
  RefreshResponse,
  ResponseDetailResponse,
  ReviewResponseRequest,
  SubmitResponseRequest,
  SurveyDetailResponse,
  SurveyQuestionRecord,
  SurveyRecord,
  SurveyResponseRecord,
  SurveySectionRecord,
  PermissionRecord,
  RoleGroupRecord,
  CreateRoleGroupRequest,
  UpdateRoleGroupRequest,
  UpdateQuestionRequest,
  UpdateSectionRequest,
  UpdateSurveyRequest,
} from "@soc/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export class ApiClientHttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "ApiClientHttpError";
  }
}

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

interface ListQueryOptions {
  limit?: number;
  page?: number;
}

const buildListQuery = (options?: ListQueryOptions): string => {
  if (!options) {
    return "";
  }

  const params = new URLSearchParams();

  if (options.page !== undefined) {
    params.set("page", String(options.page));
  }

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const withNoTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

const resolveAuthBaseUrl = (normalizedBaseUrl: string): string => {
  if (
    /\/api\/v1$/i.test(normalizedBaseUrl) ||
    /\/v1$/i.test(normalizedBaseUrl)
  ) {
    return `${normalizedBaseUrl}/auth`;
  }

  if (/\/api$/i.test(normalizedBaseUrl)) {
    // Reverse proxy usually maps /api/* -> backend /v1/*
    return `${normalizedBaseUrl}/auth`;
  }

  return `${normalizedBaseUrl}/v1/auth`;
};

const resolveSurveyBaseUrl = (normalizedBaseUrl: string): string => {
  if (/\/api\/v1$/i.test(normalizedBaseUrl) || /\/v1$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/surveys`;
  }
  if (/\/api$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/surveys`;
  }
  return `${normalizedBaseUrl}/v1/surveys`;
};

const resolveRoleGroupsBaseUrl = (normalizedBaseUrl: string): string => {
  if (/\/api\/v1$/i.test(normalizedBaseUrl) || /\/v1$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/role-groups`;
  }
  if (/\/api$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/role-groups`;
  }
  return `${normalizedBaseUrl}/v1/role-groups`;
};

const isAuthExpiredStatus = (status: number): boolean => status === 401 || status === 403;

const redirectToLogin = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const target = "/login?status=error&reason=session_expired";
  const current = `${window.location.pathname}${window.location.search}`;

  if (current === target) {
    return;
  }

  window.location.assign(target);
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new ApiClientHttpError(response.status);
  }

  return response.json() as Promise<T>;
};

export const createApiClient = ({
  baseUrl,
  fetcher = fetch,
}: ApiClientOptions) => {
  const normalizedBaseUrl = withNoTrailingSlash(baseUrl);
  const authBaseUrl = resolveAuthBaseUrl(normalizedBaseUrl);
  const surveyBaseUrl = resolveSurveyBaseUrl(normalizedBaseUrl);
  const roleGroupsBaseUrl = resolveRoleGroupsBaseUrl(normalizedBaseUrl);
  let refreshInFlight: Promise<void> | null = null;

  const sendRefreshRequest = async (): Promise<void> => {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const response = await fetcher(`${authBaseUrl}/refresh`, {
          body: JSON.stringify({}),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const error = new ApiClientHttpError(response.status);

          if (isAuthExpiredStatus(response.status)) {
            redirectToLogin();
          }

          throw error;
        }
      })();
    }

    try {
      await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  };

  const requestJson = async <T>(
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<T> => {
    const response = await fetcher(url, {
      credentials: "include",
      ...init,
    });

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest();

      const retriedResponse = await fetcher(url, {
        credentials: "include",
        ...init,
      });

      return readJson<T>(retriedResponse);
    }

    return readJson<T>(response);
  };

  return {
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

    getBoards: async (): Promise<BoardListResponse> => {
      return requestJson<BoardListResponse>(`${normalizedBaseUrl}/boards`, {
        method: "GET",
      });
    },

    getBoard: async (code: string): Promise<BoardSummary> => {
      return requestJson<BoardSummary>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}`,
        {
          method: "GET",
        },
      );
    },

    getArticles: async (
      code: string,
      options?: ListQueryOptions,
    ): Promise<ArticleListResponse> => {
      return requestJson<ArticleListResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles${buildListQuery(options)}`,
        {
          method: "GET",
        },
        {
          retryOnUnauthorized: true,
        },
      );
    },

    getArticle: async (
      code: string,
      articleId: string,
    ): Promise<ArticleDetailResponse> => {
      return requestJson<ArticleDetailResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
        {
          method: "GET",
        },
        {
          retryOnUnauthorized: true,
        },
      );
    },

    createArticle: async (
      code: string,
      input: ArticleCreateRequest,
    ): Promise<ArticleCreateResponse> => {
      return requestJson<ArticleCreateResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles`,
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
    },

    updateArticle: async (
      code: string,
      articleId: string,
      input: ArticleUpdateRequest,
    ): Promise<ArticleUpdateResponse> => {
      return requestJson<ArticleUpdateResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
    },

    deleteArticle: async (
      code: string,
      articleId: string,
    ): Promise<ArticleDeleteResponse> => {
      return requestJson<ArticleDeleteResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
        {
          method: "DELETE",
        },
      );
    },

    getComments: async (
      code: string,
      articleId: string,
      options?: ListQueryOptions,
    ): Promise<CommentListResponse> => {
      return requestJson<CommentListResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments${buildListQuery(options)}`,
        {
          method: "GET",
        },
        {
          retryOnUnauthorized: true,
        },
      );
    },

    createComment: async (
      code: string,
      articleId: string,
      input: CommentCreateRequest,
    ): Promise<CommentCreateResponse> => {
      return requestJson<CommentCreateResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments`,
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
    },

    updateComment: async (
      code: string,
      articleId: string,
      commentId: string,
      input: CommentUpdateRequest,
    ): Promise<CommentUpdateResponse> => {
      return requestJson<CommentUpdateResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}`,
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
    },

    deleteComment: async (
      code: string,
      articleId: string,
      commentId: string,
    ): Promise<CommentDeleteResponse> => {
      return requestJson<CommentDeleteResponse>(
        `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: "DELETE",
        },
      );
    },

    getCurrentUser: async (): Promise<CurrentUserResponse> => {
      return requestJson<CurrentUserResponse>(`${authBaseUrl}/me`, {
        method: "GET",
      });
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

    refreshSession: async (): Promise<RefreshResponse> => {
      return requestJson<RefreshResponse>(`${authBaseUrl}/refresh`, {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    },

    logout: async (): Promise<LogoutResponse> => {
      return requestJson<LogoutResponse>(`${authBaseUrl}/logout`, {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    },

    loginWithMockSession: async (): Promise<MockLoginResponse> => {
      return requestJson<MockLoginResponse>(`${authBaseUrl}/login/mock`, {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }, { retryOnUnauthorized: true });
    },

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

    listPermissions: async (): Promise<PermissionRecord[]> => {
      return requestJson<PermissionRecord[]>(
        `${roleGroupsBaseUrl}/permissions`,
        {
          method: "GET",
        },
        { retryOnUnauthorized: true },
      );
    },

    listRoleGroups: async (): Promise<RoleGroupRecord[]> => {
      return requestJson<RoleGroupRecord[]>(
        `${roleGroupsBaseUrl}`,
        {
          method: "GET",
        },
        { retryOnUnauthorized: true },
      );
    },

    createRoleGroup: async (
      body: CreateRoleGroupRequest,
    ): Promise<RoleGroupRecord> => {
      return requestJson<RoleGroupRecord>(
        `${roleGroupsBaseUrl}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },

    updateRoleGroup: async (
      roleGroupId: number,
      body: UpdateRoleGroupRequest,
    ): Promise<RoleGroupRecord> => {
      return requestJson<RoleGroupRecord>(
        `${roleGroupsBaseUrl}/${roleGroupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },

    deleteRoleGroup: async (roleGroupId: number): Promise<void> => {
      const response = await fetcher(
        `${roleGroupsBaseUrl}/${roleGroupId}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new ApiClientHttpError(response.status);
      }
    },

    getSurveyDetail: async (surveyId: string): Promise<SurveyDetailResponse> => {
      return requestJson<SurveyDetailResponse>(`${surveyBaseUrl}/${surveyId}`, {
        method: "GET",
      });
    },

    submitSurveyResponse: async (
      surveyId: string,
      body: SubmitResponseRequest,
    ): Promise<ResponseDetailResponse> => {
      return requestJson<ResponseDetailResponse>(`${surveyBaseUrl}/${surveyId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },

    // --- Admin survey methods ---

    listSurveys: async (): Promise<SurveyRecord[]> => {
      return requestJson<SurveyRecord[]>(surveyBaseUrl, {
        method: "GET",
      }, { retryOnUnauthorized: true });
    },

    createSurvey: async (body: CreateSurveyRequest): Promise<SurveyRecord> => {
      return requestJson<SurveyRecord>(surveyBaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, { retryOnUnauthorized: true });
    },

    updateSurvey: async (surveyId: string, body: UpdateSurveyRequest): Promise<SurveyRecord> => {
      return requestJson<SurveyRecord>(`${surveyBaseUrl}/${surveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, { retryOnUnauthorized: true });
    },

    deleteSurvey: async (surveyId: string): Promise<void> => {
      const res = await fetcher(`${surveyBaseUrl}/${surveyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new ApiClientHttpError(res.status);
    },

    createSection: async (
      surveyId: string,
      body: CreateSectionRequest,
    ): Promise<SurveySectionRecord> => {
      return requestJson<SurveySectionRecord>(`${surveyBaseUrl}/${surveyId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, { retryOnUnauthorized: true });
    },

    updateSection: async (
      surveyId: string,
      sectionId: string,
      body: UpdateSectionRequest,
    ): Promise<SurveySectionRecord> => {
      return requestJson<SurveySectionRecord>(
        `${surveyBaseUrl}/${surveyId}/sections/${sectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },

    deleteSection: async (surveyId: string, sectionId: string): Promise<void> => {
      const res = await fetcher(`${surveyBaseUrl}/${surveyId}/sections/${sectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new ApiClientHttpError(res.status);
    },

    createQuestion: async (
      surveyId: string,
      sectionId: string,
      body: CreateQuestionRequest,
    ): Promise<SurveyQuestionRecord> => {
      return requestJson<SurveyQuestionRecord>(
        `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },

    updateQuestion: async (
      surveyId: string,
      sectionId: string,
      questionId: string,
      body: UpdateQuestionRequest,
    ): Promise<SurveyQuestionRecord> => {
      return requestJson<SurveyQuestionRecord>(
        `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions/${questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },

    deleteQuestion: async (
      surveyId: string,
      sectionId: string,
      questionId: string,
    ): Promise<void> => {
      const res = await fetcher(
        `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions/${questionId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new ApiClientHttpError(res.status);
    },

    listResponses: async (surveyId: string): Promise<SurveyResponseRecord[]> => {
      return requestJson<SurveyResponseRecord[]>(`${surveyBaseUrl}/${surveyId}/responses`, {
        method: "GET",
      }, { retryOnUnauthorized: true });
    },

    getResponseDetail: async (
      surveyId: string,
      responseId: string,
    ): Promise<ResponseDetailResponse> => {
      return requestJson<ResponseDetailResponse>(
        `${surveyBaseUrl}/${surveyId}/responses/${responseId}`,
        { method: "GET" },
        { retryOnUnauthorized: true },
      );
    },

    reviewResponse: async (
      surveyId: string,
      responseId: string,
      body: ReviewResponseRequest,
    ): Promise<SurveyResponseRecord> => {
      return requestJson<SurveyResponseRecord>(
        `${surveyBaseUrl}/${surveyId}/responses/${responseId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { retryOnUnauthorized: true },
      );
    },
  };
};
