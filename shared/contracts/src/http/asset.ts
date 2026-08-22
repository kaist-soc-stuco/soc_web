export interface AssetDirectUploadPrepareRequest {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AssetDirectUploadPrepareResponse {
  storageKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

export interface AssetDirectUploadCompleteRequest {
  storageKey: string;
}

export interface AssetUploadResponse {
  assetId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}
