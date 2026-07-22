export const areArticleAssetsAttachable = (input: {
  actingUserId: string;
  currentArticleId?: number;
  requestedAssetIds: number[];
  assets: Array<{ assetId: number; uploadedBy: string }>;
  links: Array<{ articleId: number; assetId: number }>;
}): boolean => {
  if (new Set(input.requestedAssetIds).size !== input.requestedAssetIds.length) {
    return false;
  }

  const assetById = new Map(
    input.assets.map((asset) => [asset.assetId, asset]),
  );

  return input.requestedAssetIds.every((assetId) => {
    const asset = assetById.get(assetId);
    if (!asset) {
      return false;
    }

    const links = input.links.filter((link) => link.assetId === assetId);
    if (input.currentArticleId === undefined) {
      return asset.uploadedBy === input.actingUserId && links.length === 0;
    }

    if (links.some((link) => link.articleId !== input.currentArticleId)) {
      return false;
    }

    const alreadyLinkedToArticle = links.some(
      (link) => link.articleId === input.currentArticleId,
    );
    return alreadyLinkedToArticle || asset.uploadedBy === input.actingUserId;
  });
};
