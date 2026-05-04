import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface AssetUploadInput {
  buffer: Buffer;
  contentType: string;
  originalName: string;
}

export interface AssetStorageProvider {
  upload(input: AssetUploadInput): Promise<string>;
}

export const AssetStorageProvider = Symbol("AssetStorageProvider");

@Injectable()
export class MemoryAssetStorageProvider implements AssetStorageProvider {
  async upload(input: AssetUploadInput): Promise<string> {
    const normalized = input.originalName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    const safeName = normalized.length > 0 ? normalized : "file";
    return `assets/${randomUUID()}-${safeName}`;
  }
}
