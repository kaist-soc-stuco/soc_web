import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetReferenceUrl } from "@/lib/asset-reference-url";

export function resolveAssetUrl(storageKey: string): string {
  const apiBaseUrl = resolveApiBaseUrl();
  const protectedAssetUrl = resolveAssetReferenceUrl(storageKey, apiBaseUrl);
  if (protectedAssetUrl) {
    return protectedAssetUrl;
  }

  if (/^https?:\/\//i.test(storageKey)) {
    return storageKey;
  }

  if (!storageKey.startsWith("/")) {
    return storageKey;
  }

  const origin = apiBaseUrl
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/api$/i, "");

  return `${origin}${storageKey}`;
}
