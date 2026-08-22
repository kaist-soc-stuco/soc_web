import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { msToIso, nowMs } from "@soc/shared";

export interface AssetUploadInput {
  buffer: Buffer;
  contentType: string;
  originalName: string;
}

export interface AssetDirectUploadInput {
  contentType: string;
  originalName: string;
  sizeBytes: number;
}

export interface AssetDirectUploadPreparation {
  storageKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

export interface AssetUploadedObject {
  sizeBytes: number;
  contentType: string | null;
}

export interface AssetStorageProvider {
  upload(input: AssetUploadInput): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  createPresignedUpload?(input: AssetDirectUploadInput): Promise<AssetDirectUploadPreparation>;
  verifyUpload?(storageKey: string): Promise<AssetUploadedObject>;
  migrateLocalObject?(input: {
    storageKey: string;
    originalName: string;
    contentType: string;
  }): Promise<string>;
}

export const AssetStorageProvider = Symbol("AssetStorageProvider");

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
      this.configService.get<string>("ASSET_UPLOAD_DIR") ??
      path.resolve(process.cwd(), "uploads", "assets");
  }

  async upload(input: AssetUploadInput): Promise<string> {
    const storedName = sanitizeFilename(input.originalName);

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, storedName), input.buffer);

    return `/uploads/assets/${storedName}`;
  }

  async read(storageKey: string): Promise<Buffer> {
    const storedName = path.basename(storageKey);
    if (!storedName) {
      throw new Error("asset_storage_key_invalid");
    }

    const uploadRoot = path.resolve(this.uploadDir);
    const targetPath = path.resolve(uploadRoot, storedName);
    if (!targetPath.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new Error("asset_path_outside_upload_dir");
    }

    return readFile(targetPath);
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

@Injectable()
export class S3AssetStorageProvider implements AssetStorageProvider {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.requireConfig("AWS_S3_BUCKET");
    this.prefix = (this.configService.get<string>("AWS_S3_PREFIX") ?? "assets")
      .replace(/^\/+|\/+$/g, "")
      .trim();

    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY");
    const endpoint = this.configService.get<string>("AWS_S3_ENDPOINT");

    this.client = new S3Client({
      region: this.requireConfig("AWS_REGION"),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: this.configService.get<boolean>(
        "AWS_S3_FORCE_PATH_STYLE",
        false,
      ),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async upload(input: AssetUploadInput): Promise<string> {
    const objectKey = this.buildObjectKey(input.originalName);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.contentType,
        ContentLength: input.buffer.byteLength,
        ServerSideEncryption: "AES256",
      }),
    );

    return `s3://${this.bucket}/${objectKey}`;
  }

  async createPresignedUpload(
    input: AssetDirectUploadInput,
  ): Promise<AssetDirectUploadPreparation> {
    const expiresInSeconds = 10 * 60;
    const objectKey = this.buildObjectKey(input.originalName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ServerSideEncryption: "AES256",
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      storageKey: `s3://${this.bucket}/${objectKey}`,
      uploadUrl,
      uploadHeaders: {
        "Content-Type": input.contentType,
        "x-amz-server-side-encryption": "AES256",
      },
      expiresAt: msToIso(nowMs() + expiresInSeconds * 1000),
    };
  }

  async verifyUpload(storageKey: string): Promise<AssetUploadedObject> {
    const objectKey = this.parseStorageKey(storageKey);
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );

    if (response.ContentLength === undefined) {
      throw new Error("asset_s3_content_length_missing");
    }

    return {
      sizeBytes: response.ContentLength,
      contentType: response.ContentType ?? null,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    const objectKey = this.parseStorageKey(storageKey);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );

    if (!response.Body) throw new Error("asset_s3_body_missing");
    return readS3Body(response.Body);
  }

  async delete(storageKey: string): Promise<void> {
    const objectKey = this.parseStorageKey(storageKey);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }

  private parseStorageKey(storageKey: string): string {
    const prefix = `s3://${this.bucket}/`;
    if (!storageKey.startsWith(prefix)) {
      throw new Error("asset_s3_storage_key_invalid");
    }

    const objectKey = storageKey.slice(prefix.length);
    if (!objectKey || objectKey.includes("..")) {
      throw new Error("asset_s3_storage_key_invalid");
    }
    return objectKey;
  }

  private buildObjectKey(originalName: string): string {
    return [this.prefix, sanitizeFilename(originalName)]
      .filter(Boolean)
      .join("/");
  }

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
  }
}

@Injectable()
export class ConfiguredAssetStorageProvider implements AssetStorageProvider {
  private readonly local: LocalAssetStorageProvider;
  private readonly s3: S3AssetStorageProvider | null;

  constructor(configService: ConfigService) {
    this.local = new LocalAssetStorageProvider(configService);
    this.s3 =
      configService.get<string>("ASSET_STORAGE_PROVIDER") === "s3"
        ? new S3AssetStorageProvider(configService)
        : null;
  }

  upload(input: AssetUploadInput): Promise<string> {
    return this.s3 ? this.s3.upload(input) : this.local.upload(input);
  }

  createPresignedUpload(
    input: AssetDirectUploadInput,
  ): Promise<AssetDirectUploadPreparation> {
    return this.requireS3().createPresignedUpload(input);
  }

  verifyUpload(storageKey: string): Promise<AssetUploadedObject> {
    return this.requireS3().verifyUpload(storageKey);
  }

  async migrateLocalObject(input: {
    storageKey: string;
    originalName: string;
    contentType: string;
  }): Promise<string> {
    const buffer = await this.local.read(input.storageKey);
    return this.requireS3().upload({
      buffer,
      contentType: input.contentType,
      originalName: input.originalName,
    });
  }

  read(storageKey: string): Promise<Buffer> {
    return storageKey.startsWith("s3://")
      ? this.requireS3().read(storageKey)
      : this.local.read(storageKey);
  }

  delete(storageKey: string): Promise<void> {
    return storageKey.startsWith("s3://")
      ? this.requireS3().delete(storageKey)
      : this.local.delete(storageKey);
  }

  private requireS3(): S3AssetStorageProvider {
    if (!this.s3) throw new Error("asset_s3_provider_not_configured");
    return this.s3;
  }
}

async function readS3Body(body: unknown): Promise<Buffer> {
  if (body instanceof Uint8Array) return Buffer.from(body);

  const transformToByteArray = (
    body as { transformToByteArray?: () => Promise<Uint8Array> }
  ).transformToByteArray;
  if (typeof transformToByteArray === "function") {
    return Buffer.from(await transformToByteArray.call(body));
  }

  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("asset_s3_body_unsupported");
}
