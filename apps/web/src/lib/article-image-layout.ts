import type { ArticleAssetItem } from "@soc/contracts";

function assetIdFromSource(source: string | null | undefined) {
  if (!source) return null;
  const reference = /^asset:(\d+)$/.exec(source);
  if (reference) return reference[1];
  try {
    const path = new URL(source, "https://local.invalid").pathname;
    return /^\/(?:api\/)?(?:v\d+\/)?assets\/(\d+)\/content$/i.exec(path)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** List thumbnails may fall back to a body image; that does not make it a detail-page poster. */
export function getArticleImageLayout(article: {
  assets?: ArticleAssetItem[];
  thumbnailStorageKey?: string | null;
  contentKo?: string | null;
  contentEn?: string | null;
}) {
  const inlineIds = new Set<string>();
  for (const content of [article.contentKo, article.contentEn]) {
    for (const [tag] of (content ?? "").matchAll(/<img\b[^>]*>/gi)) {
      const source = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const id = assetIdFromSource(source?.[1] ?? source?.[2] ?? source?.[3]);
      if (id) inlineIds.add(id);
    }
  }
  const assets = article.assets ?? [];
  const inlineAsset = (asset: ArticleAssetItem) => inlineIds.has(asset.assetId)
    || inlineIds.has(assetIdFromSource(asset.storageKey) ?? "");
  const thumbnailId = assetIdFromSource(article.thumbnailStorageKey);
  const posterAsset = assets.find(asset => asset.usageType === "THUMBNAIL" && !inlineAsset(asset))
    ?? assets.find(asset => asset.usageType !== "ATTACHMENT" && !inlineAsset(asset)
      && (asset.storageKey === article.thumbnailStorageKey || asset.assetId === thumbnailId))
    ?? assets.find(asset => asset.usageType === "IMAGE" && !inlineAsset(asset));
  const posterStorageKey = posterAsset?.storageKey
    ?? (thumbnailId && inlineIds.has(thumbnailId) ? null : article.thumbnailStorageKey ?? null);
  const attachmentAssets = assets.filter(asset => asset.assetId !== posterAsset?.assetId
    && (asset.usageType === "ATTACHMENT" || !inlineAsset(asset)));
  return { posterAsset, posterStorageKey, attachmentAssets };
}
