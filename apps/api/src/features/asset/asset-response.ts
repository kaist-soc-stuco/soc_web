const SAFE_INLINE_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const asciiFilename = (value: string): string => {
  const normalized = value
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim();

  return normalized || "download";
};

export const buildAssetResponseHeaders = (input: {
  inline: boolean;
  mimeType: string;
  originalFilename: string;
}): Record<string, string> => {
  const mayRenderInline =
    input.inline && SAFE_INLINE_IMAGE_TYPES.has(input.mimeType);
  const disposition = mayRenderInline ? "inline" : "attachment";
  const contentType = mayRenderInline
    ? input.mimeType
    : "application/octet-stream";

  return {
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": `${disposition}; filename="${asciiFilename(input.originalFilename)}"; filename*=UTF-8''${encodeRfc5987(input.originalFilename)}`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  };
};
