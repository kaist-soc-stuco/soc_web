export interface AssetDirectUploadPrepareRequest {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AssetDirectUploadPrepareResponse {
  storageKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  /** S3 direct uploads use a POST policy so content length is enforced by the provider. */
  uploadMethod?: "PUT" | "POST";
  uploadFields?: Record<string, string>;
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
