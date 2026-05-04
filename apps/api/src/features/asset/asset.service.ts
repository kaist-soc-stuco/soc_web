import { Inject, Injectable } from "@nestjs/common";

import { AssetRepository } from "./repositories/asset.repository";
import { AssetStorageProvider } from "./asset.storage";

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class AssetService {
  constructor(
    private readonly assetRepository: AssetRepository,
    @Inject(AssetStorageProvider)
    private readonly storage: AssetStorageProvider,
  ) {}

  async uploadFile(input: {
    file: UploadedAssetFile;
    userId: string;
  }): Promise<{ assetId: string }> {
    // TODO: [Tech Debt] S3 미사용 파일 정리 배치 작업 필요
    const storageKey = await this.storage.upload({
      buffer: input.file.buffer,
      contentType: input.file.mimetype,
      originalName: input.file.originalname,
    });

    const asset = await this.assetRepository.createAsset({
      storageKey,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      uploadedBy: input.userId,
    });

    return { assetId: asset.assetId };
  }
}
