const ASSET_REFERENCE_PREFIX = "asset:";

export const toAssetReference = (assetId: string | number): string =>
  `${ASSET_REFERENCE_PREFIX}${assetId}`;

const ASSET_REFERENCE_PATTERN = /(?:asset:|\/assets\/)(\d+)(?:\/content)?/g;

export const collectAssetReferenceIds = (...values: unknown[]): string[] => {
  const assetIds = new Set<string>();

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(ASSET_REFERENCE_PATTERN)) {
        if (match[1]) assetIds.add(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };

  values.forEach(visit);
  return [...assetIds];
};
