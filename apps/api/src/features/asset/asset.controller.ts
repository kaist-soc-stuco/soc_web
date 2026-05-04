import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";

import { AuthGuard } from "../../shared/guards";
import { AssetService } from "./asset.service";

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

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /^(image\/(png|jpeg|jpg|gif|webp)|application\/pdf)$/i;

@Controller("assets")
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post("upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
        exceptionFactory: (error) => new BadRequestException(error),
      }),
    ) file: UploadedAssetFile,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException("user_not_found_in_request");
    }

    return this.assetService.uploadFile({
      file,
      userId: request.user.id,
    });
  }
}
