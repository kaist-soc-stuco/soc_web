const withNoTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const resolveApiBaseUrl = (): string => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (apiBaseUrl) {
    return withNoTrailingSlash(apiBaseUrl);
  }

  const startUrl = (import.meta.env.VITE_SSO_START_URL as string | undefined)?.trim();
  if (startUrl) {
    try {
      const parsed = new URL(startUrl);
      const path = parsed.pathname.replace(/\/auth\/login\/start$/, "");
      return `${parsed.origin}${path}`;
    } catch {
      return "/api";
    }
  }

  return "/api";
};
