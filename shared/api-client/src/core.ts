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

    return (
      /\/v1\/surveys(?:\/|$)/.test(parsed.pathname) ||
      /\/v1\/auth\/(?:session|me)$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

const withCredentialsAndTemporaryAuth = (
  url: string,
  init: RequestInit,
): RequestInit => {
  const accessToken = shouldAttachTemporaryAuth(url)
    ? readTemporaryAccessToken()
    : undefined;
  if (!accessToken) {
    return { credentials: "include", ...init };
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
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
  let refreshInFlight: Promise<void> | null = null;

  const sendRefreshRequest = async (): Promise<void> => {
    if (readTemporaryAccessToken()) {
      redirectToLogin();
      throw new ApiClientHttpError(401, "temporary_session_expired");
    }

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
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest();

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
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest();

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
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest();

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
    const response = await fetcher(
      url,
      withCredentialsAndTemporaryAuth(url, init),
    );

    if (response.status === 401 && options?.retryOnUnauthorized) {
      await sendRefreshRequest();

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

  return {
    auditLogsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "audit-logs"),
    assetBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "assets"),
    authBaseUrl,
    calendarBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "calendar"),
    contactsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "contacts"),
    emailsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "admin/emails"),
    normalizedBaseUrl,
    notificationsBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "notifications"),
    roadmapBaseUrl: resolveResourceBaseUrl(normalizedBaseUrl, "roadmap"),
    putObject,
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
