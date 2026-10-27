import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
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
  read(storageKey: string): Promise<Buffer>;
  readStream?(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}

export const AssetStorageProvider = Symbol("AssetStorageProvider");

const MAX_BUFFERED_ASSET_BYTES = 20 * 1024 * 1024;

const sanitizeFilename = (originalName: string) => {
  const normalized = originalName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const extension = path
    .extname(originalName)
    .replace(/[^a-zA-Z0-9.]/g, "");
  const safeName =
    normalized.length > 0 && normalized !== extension
      ? normalized
      : `file${extension}`;

  return `${randomUUID()}-${safeName}`;
};

@Injectable()
export class LocalAssetStorageProvider implements AssetStorageProvider {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>("ASSET_UPLOAD_DIR")?.trim() ||
      path.resolve(process.cwd(), "uploads", "assets");
  }

  async upload(input: AssetUploadInput): Promise<string> {
    const storedName = sanitizeFilename(input.originalName);

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, storedName), input.buffer);

    return `/uploads/assets/${storedName}`;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readBoundedBody(createReadStream(this.resolvePath(storageKey)), MAX_BUFFERED_ASSET_BYTES);
  }

  async readStream(storageKey: string): Promise<Readable> {
    return createReadStream(this.resolvePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storageKey));
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

  private resolvePath(storageKey: string): string {
    const prefix = "/uploads/assets/";
    if (!storageKey.startsWith(prefix)) throw new Error("asset_storage_key_invalid");
    const storedName = storageKey.slice(prefix.length);
    if (!storedName || storedName === "." || storedName === ".." || /[\\/\0]/.test(storedName)) {
      throw new Error("asset_storage_key_invalid");
    }
    const uploadRoot = path.resolve(this.uploadDir);
    const targetPath = path.resolve(uploadRoot, storedName);
    if (!targetPath.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("asset_path_outside_upload_dir");
    return targetPath;
  }
}

async function readBoundedBody(body: unknown, maxBytes: number): Promise<Buffer> {
  if (body instanceof Uint8Array) {
    if (body.byteLength > maxBytes) throw new Error("asset_body_too_large");
    return Buffer.from(body);
  }

  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.byteLength;
      if (total > maxBytes) {
        (body as { destroy?: () => void }).destroy?.();
        throw new Error("asset_body_too_large");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  throw new Error("asset_body_unsupported");
}
