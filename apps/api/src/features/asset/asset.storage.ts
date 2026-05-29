import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface AssetUploadInput {
  buffer: Buffer;
  contentType: string;
  originalName: string;
}

export interface AssetStorageProvider {
  upload(input: AssetUploadInput): Promise<string>;
  delete(storageKey: string): Promise<void>;
}

export const AssetStorageProvider = Symbol("AssetStorageProvider");

@Injectable()
export class LocalAssetStorageProvider implements AssetStorageProvider {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>("ASSET_UPLOAD_DIR") ??
      path.resolve(process.cwd(), "uploads", "assets");
  }

  async upload(input: AssetUploadInput): Promise<string> {
    const normalized = input.originalName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    const extension = path
      .extname(input.originalName)
      .replace(/[^a-zA-Z0-9.]/g, "");
    const safeName =
      normalized.length > 0 && normalized !== extension
        ? normalized
        : `file${extension}`;
    const storedName = `${randomUUID()}-${safeName}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, storedName), input.buffer);

    return `/uploads/assets/${storedName}`;
  }

  async delete(storageKey: string): Promise<void> {
    const storedName = path.basename(storageKey);
    if (!storedName) {
      return;
    }

    const uploadRoot = path.resolve(this.uploadDir);
    const targetPath = path.resolve(uploadRoot, storedName);
    if (!targetPath.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new Error("asset_path_outside_upload_dir");
    }

    try {
      await unlink(targetPath);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;

      if (code === "ENOENT") {
        return;
      }

      throw error;
    }
  }
}
