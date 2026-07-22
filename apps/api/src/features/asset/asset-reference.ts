const ASSET_REFERENCE_PREFIX = "asset:";

export const toAssetReference = (assetId: string | number): string =>
  `${ASSET_REFERENCE_PREFIX}${assetId}`;
