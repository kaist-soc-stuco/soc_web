import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function resolveAssetUrl(storageKey: string): string {
  if (/^https?:\/\//i.test(storageKey)) {
    return storageKey;
  }

  if (!storageKey.startsWith("/")) {
    return storageKey;
  }

  const apiBaseUrl = resolveApiBaseUrl().replace(/\/+$/, "");
  const origin = apiBaseUrl
    .replace(/\/api\/v1$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/api$/i, "");

  return `${origin}${storageKey}`;
}
