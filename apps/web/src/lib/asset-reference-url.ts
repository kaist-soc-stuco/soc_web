const withNoTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const resolveAssetsBaseUrl = (apiBaseUrl: string): string => {
  const normalized = withNoTrailingSlash(apiBaseUrl);

  if (
    /\/api\/v1$/i.test(normalized) ||
    /\/v1$/i.test(normalized) ||
    /\/api$/i.test(normalized)
  ) {
    return `${normalized}/assets`;
  }

  return `${normalized}/v1/assets`;
};

export const resolveAssetReferenceUrl = (
  storageKey: string,
  apiBaseUrl: string,
): string | null => {
  const match = /^asset:(\d+)$/.exec(storageKey);
  if (!match) {
    return null;
  }

  return `${resolveAssetsBaseUrl(apiBaseUrl)}/${match[1]}/content`;
};
