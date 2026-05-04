import { Inject, Injectable } from "@nestjs/common";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import { assets } from "../../../infrastructure/postgres/postgres.schema";

@Injectable()
export class AssetRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async createAsset(input: {
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
  }): Promise<{ assetId: string }> {
    const [created] = await this.db
      .insert(assets)
      .values({
        storageKey: input.storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: null,
        uploadedBy: Number(input.uploadedBy),
      })
      .returning({ assetId: assets.assetId });

    return { assetId: String(created.assetId) };
  }
}
