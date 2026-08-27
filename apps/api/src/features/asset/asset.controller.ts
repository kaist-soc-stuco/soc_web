import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ParseFilePipe,
  MaxFileSizeValidator,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Permissions } from "@soc/contracts";
import type {
  AssetDirectUploadCompleteRequest,
  AssetDirectUploadPrepareRequest,
} from "@soc/contracts";
import { Request, Response } from "express";

import { AuthGuard, RequirePermissions } from "../auth/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
import { AUTH_ACCESS_COOKIE_NAME } from "../auth/auth.tokens";
import { AuthSessionService } from "../auth/auth-session.service";
import { AssetService } from "./asset.service";
import { buildAssetResponseHeaders } from "./asset-response";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permission: number;
  };
}

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
// Multer/ParseFilePipe interpret their configured limit as an exclusive upper
// bound, so the first invalid size keeps 20 MiB itself valid.
const FIRST_INVALID_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES + 1;
const ALLOWED_ASSET_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

@Controller("assets")
export class AssetController {
  constructor(
    private readonly assetService: AssetService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Get(":assetId/content")
  async getContent(
    @Param("assetId") assetId: string,
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!/^\d+$/.test(assetId)) {
      throw new BadRequestException("asset_id_invalid");
    }

    const currentUser =
      await this.authSessionService.getOptionalCurrentUser(accessToken);
    const file = await this.assetService.getFile(assetId, currentUser);
    const headers = buildAssetResponseHeaders(file);

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    response.setHeader("Content-Length", String(file.buffer.byteLength));

    return new StreamableFile(file.buffer);
  }

  @Post("upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: FIRST_INVALID_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({
            maxSize: FIRST_INVALID_FILE_SIZE_BYTES,
          }),
        ],
        exceptionFactory: (error) => new BadRequestException(error),
      }),
    )
    file: UploadedAssetFile,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }

    if (!ALLOWED_ASSET_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("unsupported_asset_mime_type");
    }

    return this.assetService.uploadFile({
      file,
      userId: request.user.id,
    });
  }

  @Post("presign")
  @UseGuards(AuthGuard)
  async presign(
    @Body() body: AssetDirectUploadPrepareRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }
    if (
      typeof body?.originalFilename !== "string" ||
      typeof body?.mimeType !== "string" ||
      !Number.isInteger(body?.sizeBytes) ||
      body.sizeBytes <= 0 ||
      body.sizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw new BadRequestException("asset_metadata_invalid");
    }
    if (!ALLOWED_ASSET_MIME_TYPES.has(body.mimeType)) {
      throw new BadRequestException("unsupported_asset_mime_type");
    }

    return this.assetService.prepareDirectUpload({
      originalFilename: body.originalFilename,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      userId: request.user.id,
    });
  }

  @Post("complete")
  @UseGuards(AuthGuard)
  async complete(
    @Body() body: AssetDirectUploadCompleteRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }
    if (
      typeof body?.storageKey !== "string" ||
      !body.storageKey.startsWith("s3://")
    ) {
      throw new BadRequestException("asset_storage_key_invalid");
    }

    return this.assetService.completeDirectUpload({
      storageKey: body.storageKey,
      userId: request.user.id,
    });
  }

  @Post("cleanup-orphans")
  @RequirePermissions(Permissions.SUPER_ADMIN)
  async cleanupOrphans() {
    return this.assetService.cleanupUnlinkedAssets();
  }

  @Post("migrate-local")
  @RequirePermissions(Permissions.SUPER_ADMIN)
  async migrateLocal(@Body() body: { limit?: number }) {
    const rawLimit = Number(body?.limit ?? 100);
    const limit = Number.isInteger(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 500)
      : 100;
    return this.assetService.migrateLocalAssets(limit);
  }
}
