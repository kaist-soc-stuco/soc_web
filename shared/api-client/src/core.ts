import type { RefreshResponse } from "@soc/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface ListQueryOptions {
  limit?: number;
  page?: number;
  period?: "all" | "today" | "7days" | "30days";
  q?: string;
  searchBy?: "title" | "author" | "title_content";
  sortBy?: "latest" | "views";
  sortDirection?: "asc" | "desc";
}

export class ApiClientHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(code ? `HTTP ${status}: ${code}` : `HTTP ${status}`);
    this.name = "ApiClientHttpError";
  }
}

export interface ApiClientContext {
  auditLogsBaseUrl: string;
  assetBaseUrl: string;
  authBaseUrl: string;
  calendarBaseUrl: string;
  contactsBaseUrl: string;
  emailsBaseUrl: string;
  normalizedBaseUrl: string;
  notificationsBaseUrl: string;
  refreshSession: (requestStartedAt?: number) => Promise<RefreshResponse>;
  roadmapBaseUrl: string;
  requestJson: <T>(
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ) => Promise<T>;
  requestText: (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ) => Promise<string>;
  requestBlob: (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ) => Promise<Blob>;
  putObject: (
    url: string,
    body: BodyInit,
    headers?: HeadersInit,
  ) => Promise<void>;
  postObject: (
    url: string,
    fields: Record<string, string>,
    file: File,
  ) => Promise<void>;
  requestVoid: (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ) => Promise<void>;
  roleGroupsBaseUrl: string;
  siteContentBaseUrl: string;
  surveyBaseUrl: string;
  usersBaseUrl: string;
  votesBaseUrl: string;
}

export const buildListQuery = (options?: ListQueryOptions): string => {
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

  if (options.q !== undefined && options.q.trim()) {
    params.set("q", options.q.trim());
  }

  if (options.searchBy !== undefined) {
    params.set("searchBy", options.searchBy);
  }

  if (options.sortBy !== undefined) {
    params.set("sortBy", options.sortBy);
  }

  if (options.sortDirection !== undefined) {
    params.set("sortDirection", options.sortDirection);
  }

  if (options.period !== undefined) {
    params.set("period", options.period);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const withNoTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

const resolveResourceBaseUrl = (
  normalizedBaseUrl: string,
  path: string,
): string => {
  if (
    /\/api\/v1$/i.test(normalizedBaseUrl) ||
    /\/v1$/i.test(normalizedBaseUrl) ||
    /\/api$/i.test(normalizedBaseUrl)
  ) {
    return `${normalizedBaseUrl}/${path}`;
  }

  return `${normalizedBaseUrl}/v1/${path}`;
};

const isAuthExpiredStatus = (status: number): boolean =>
  status === 401 || status === 403;

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
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { message?: unknown };
      if (typeof payload.message === "string") code = payload.message;
      if (Array.isArray(payload.message) && typeof payload.message[0] === "string") {
        code = payload.message[0];
      }
    } catch {
      // Error responses from proxies do not always contain JSON.
    }
    throw new ApiClientHttpError(response.status, code);
  }

  return response.json() as Promise<T>;
};

const readText = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new ApiClientHttpError(response.status);
  }

  return response.text();
};

const readBlob = async (response: Response): Promise<Blob> => {
  if (!response.ok) {
    throw new ApiClientHttpError(response.status);
  }

  return response.blob();
};

/**
 * Temporary consent sessions deliberately do not use cookies or refresh
 * tokens. The short-lived access token is kept in the current browser tab and
 * attached to API requests as a bearer credential so survey eligibility can be
 * checked without creating a persisted user account.
 */
const readTemporaryAccessToken = (): string | undefined => {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.sessionStorage.getItem("soc.auth.state");
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      temporarySession?: { accessToken?: unknown };
    };
    return typeof parsed.temporarySession?.accessToken === "string"
      ? parsed.temporarySession.accessToken
      : undefined;
  } catch {
    return undefined;
  }
};

const shouldAttachTemporaryAuth = (url: string): boolean => {
  try {
    const parsed = new URL(
      url,
      typeof window === "undefined" ? "http://localhost" : window.location.origin,
    );
    const sameOrigin =
      typeof window === "undefined" || parsed.origin === window.location.origin;

    return (
      sameOrigin &&
      (/\/(?:api\/)?(?:v1\/)?surveys(?:\/|$)/.test(parsed.pathname) ||
        /\/(?:api\/)?(?:v1\/)?auth\/(?:session|me)$/.test(parsed.pathname))
    );
  } catch {
    return false;
  }
};

const readCsrfToken = (): string | undefined => {
  if (typeof document === "undefined") return undefined;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("soc_csrf="));
  if (!cookie) return undefined;

  const value = cookie.slice("soc_csrf=".length);
  try {
    return decodeURIComponent(value) || undefined;
  } catch {
    return undefined;
  }
};

const isUnsafeMethod = (method?: string): boolean =>
  !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());

const withCredentialsAndTemporaryAuth = (
  url: string,
  init: RequestInit,
): RequestInit => {
  const accessToken = shouldAttachTemporaryAuth(url)
    ? readTemporaryAccessToken()
    : undefined;
  const headers = new Headers(init.headers);
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const csrfToken = isUnsafeMethod(init.method) ? readCsrfToken() : undefined;
  if (csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return {
    credentials: "include",
    ...init,
    headers,
  };
};

export const createApiClientContext = ({
  baseUrl,
  fetcher = fetch,
}: ApiClientOptions): ApiClientContext => {
  const normalizedBaseUrl = withNoTrailingSlash(baseUrl);
  const authBaseUrl = resolveResourceBaseUrl(normalizedBaseUrl, "auth");
  let refreshInFlight: Promise<RefreshResponse> | null = null;

  const refreshCompletedAtKey = "soc.auth.refresh-completed-at";
  const sessionActivityKey = "soc.auth.last-activity-at";
  const assertActiveBrowserSession = (): void => {
    if (typeof window === "undefined") return;

    let storedActivityAt: string | null;
    try {
      storedActivityAt = window.localStorage.getItem(sessionActivityKey);
    } catch {
      redirectToLogin();
      throw new ApiClientHttpError(401, "idle_session_unavailable");
    }

    const lastActivityAt = Number(storedActivityAt);
    if (
      storedActivityAt === null ||
      !Number.isFinite(lastActivityAt) ||
      lastActivityAt <= 0 ||
      Date.now() - lastActivityAt >= 60 * 60 * 1000
    ) {
      redirectToLogin();
      throw new ApiClientHttpError(401, "idle_session_expired");
    }
  };
  const readRefreshCompletedAt = (): number => {
    if (typeof window === "undefined") return 0;
    try {
      const value = Number(window.localStorage.getItem(refreshCompletedAtKey));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };

  const sendRefreshRequest = async (
    requestStartedAt = Date.now(),
  ): Promise<RefreshResponse> => {
    if (readTemporaryAccessToken()) {
      redirectToLogin();
      throw new ApiClientHttpError(401, "temporary_session_expired");
    }

    assertActiveBrowserSession();

    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refresh = async (): Promise<RefreshResponse> => {
          assertActiveBrowserSession();
          if (readRefreshCompletedAt() >= requestStartedAt) {
            return { storageMode: "persisted" };
          }

          const response = await fetcher(
            `${authBaseUrl}/refresh`,
            withCredentialsAndTemporaryAuth(`${authBaseUrl}/refresh`, {
              body: JSON.stringify({}),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            }),
          );

          if (!response.ok) {
            const error = new ApiClientHttpError(response.status);

            if (isAuthExpiredStatus(response.status)) {
              redirectToLogin();
            }

            throw error;
          }

          const payload = await readJson<RefreshResponse>(response);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(refreshCompletedAtKey, String(Date.now()));
            } catch {
              // Refresh still succeeds when cross-tab storage is unavailable.
            }
          }
          return payload;
        };

        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request("soc.auth.refresh", refresh);
        }

        if (typeof window !== "undefined") {
          redirectToLogin();
          throw new ApiClientHttpError(401, "refresh_coordination_unavailable");
        }

        return refresh();
      })();
    }

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  };

  const requestJson = async <T>(
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<T> => {
    const requestStartedAt = Date.now();
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest(requestStartedAt);

      const retriedResponse = await fetcher(
        url,
        withCredentialsAndTemporaryAuth(url, init),
      );

      return readJson<T>(retriedResponse);
    }

    return readJson<T>(response);
  };

  const requestVoid = async (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<void> => {
    const requestStartedAt = Date.now();
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest(requestStartedAt);

      const retriedResponse = await fetcher(
        url,
        withCredentialsAndTemporaryAuth(url, init),
      );

      if (!retriedResponse.ok) {
        throw new ApiClientHttpError(retriedResponse.status);
      }

      return;
    }

    if (!response.ok) {
      throw new ApiClientHttpError(response.status);
    }
  };

  const requestText = async (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<string> => {
    const requestStartedAt = Date.now();
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest(requestStartedAt);

      const retriedResponse = await fetcher(
        url,
        withCredentialsAndTemporaryAuth(url, init),
      );

      return readText(retriedResponse);
    }

    return readText(response);
  };

  const requestBlob = async (
    url: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<Blob> => {
    const requestStartedAt = Date.now();
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest(requestStartedAt);

      const retriedResponse = await fetcher(
        url,
        withCredentialsAndTemporaryAuth(url, init),
      );

      return readBlob(retriedResponse);
    }

    return readBlob(response);
  };

  const putObject = async (
    url: string,
    body: BodyInit,
    headers?: HeadersInit,
  ): Promise<void> => {
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, {
        body,
        headers,
        method: "PUT",
      }),
    );
    if (!response.ok) {
      throw new ApiClientHttpError(response.status);
    }
  };

  const postObject = async (
    url: string,
    fields: Record<string, string>,
    file: File,
  ): Promise<void> => {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      formData.append(name, value);
    }
    formData.append("file", file);
    const response = await fetcher(url, {
      body: formData,
      method: "POST",
    });
    if (!response.ok) {
      throw new ApiClientHttpError(response.status);
    }
  };

  return {
    auditLogsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "audit-logs"),
    assetBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "assets"),
    authBaseUrl,
    calendarBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "calendar"),
    contactsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "contacts"),
    emailsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "admin/emails"),
    normalizedBaseUrl,
    notificationsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "notifications"),
    refreshSession: sendRefreshRequest,
    roadmapBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "roadmap"),
    putObject,
    postObject,
    requestJson,
    requestBlob,
    requestText,
    requestVoid,
    roleGroupsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "role-groups"),
    siteContentBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "site-content"),
    surveyBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "surveys"),
    usersBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "users"),
    votesBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "votes"),
  };
};
