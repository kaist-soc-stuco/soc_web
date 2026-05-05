const withNoTrailingSlash = (v: string) => v.replace(/\/+$/, "");

export const resolveApiBaseUrl = (): string => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (apiBaseUrl) return withNoTrailingSlash(apiBaseUrl);
  return "/api";
};
