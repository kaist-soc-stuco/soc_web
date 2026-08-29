import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CreateRoadmapCourseSchema,
  CreateRoadmapOfferingSchema,
  Permissions,
  RoadmapImportCommitSchema,
  UpdateRoadmapCourseSchema,
  UpdateRoadmapOfferingSchema,
} from "@soc/contracts";
import type {
  AdminRoadmapOfferingListResponse,
  CreateRoadmapCourseRequest,
  CreateRoadmapOfferingRequest,
  RoadmapImportPreviewResponse,
  RoadmapOfferingImportResponse,
  RoadmapOfferingListResponse,
  UpdateRoadmapCourseRequest,
  UpdateRoadmapOfferingRequest,
} from "@soc/contracts";
import type { Request } from "express";

import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { RoadmapService } from "./roadmap.service";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

interface UploadedRoadmapFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;
const FIRST_INVALID_IMPORT_SIZE_BYTES = MAX_IMPORT_SIZE_BYTES + 1;

@Controller("roadmap")
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get("offerings")
  async listPublicOfferings(): Promise<RoadmapOfferingListResponse> {
    return this.roadmapService.listPublic();
  }

  @Get("admin")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async listAdminOfferings(): Promise<AdminRoadmapOfferingListResponse> {
    return this.roadmapService.listAdmin();
  }

  @Post("admin/import/preview")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  @UseInterceptors(roadmapFileInterceptor())
  async previewImport(
    @UploadedFile(roadmapFilePipe()) file: UploadedRoadmapFile,
  ): Promise<RoadmapImportPreviewResponse> {
    validateFile(file);
    return this.roadmapService.previewWorkbook(file);
  }

  @Post("admin/import/commit")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  @UseInterceptors(roadmapFileInterceptor())
  async commitImport(
    @UploadedFile(roadmapFilePipe()) file: UploadedRoadmapFile,
    @Body("decisions") decisions: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoadmapOfferingImportResponse> {
    validateFile(file);
    return this.roadmapService.importWorkbook(
      file,
      requireActor(request),
      parseImportDecisions(decisions),
    );
  }

  /** Compatibility endpoint for older admin clients: commit with defaults. */
  @Post("admin/import")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  @UseInterceptors(roadmapFileInterceptor())
  async importOfferings(
    @UploadedFile(roadmapFilePipe()) file: UploadedRoadmapFile,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoadmapOfferingImportResponse> {
    validateFile(file);
    return this.roadmapService.importWorkbook(file, requireActor(request));
  }

  @Post("admin/courses")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async createCourse(
    @Body(new ZodValidationPipe(CreateRoadmapCourseSchema)) body: CreateRoadmapCourseRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roadmapService.createCourse(body, requireActor(request));
  }

  @Patch("admin/courses/:courseCode")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async updateCourse(
    @Param("courseCode") courseCode: string,
    @Body(new ZodValidationPipe(UpdateRoadmapCourseSchema)) body: UpdateRoadmapCourseRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roadmapService.updateCourse(courseCode, body, requireActor(request));
  }

  @Post("admin/offerings")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async createOffering(
    @Body(new ZodValidationPipe(CreateRoadmapOfferingSchema)) body: CreateRoadmapOfferingRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roadmapService.createOffering(body, requireActor(request));
  }

  @Patch("admin/offerings/:offeringId")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async updateOffering(
    @Param("offeringId", ParseUUIDPipe) offeringId: string,
    @Body(new ZodValidationPipe(UpdateRoadmapOfferingSchema)) body: UpdateRoadmapOfferingRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roadmapService.updateOffering(offeringId, body, requireActor(request));
  }

  @Delete("admin/offerings/:offeringId")
  @RequirePermissions(Permissions.MANAGE_SITE_CONTENT)
  async deleteOffering(
    @Param("offeringId", ParseUUIDPipe) offeringId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.roadmapService.deleteOffering(offeringId, requireActor(request));
    return { success: true };
  }
}

function roadmapFileInterceptor() {
  return FileInterceptor("file", {
    limits: { fileSize: FIRST_INVALID_IMPORT_SIZE_BYTES },
  });
}

function roadmapFilePipe() {
  return new ParseFilePipe({
    fileIsRequired: true,
    validators: [
      new MaxFileSizeValidator({ maxSize: FIRST_INVALID_IMPORT_SIZE_BYTES }),
    ],
    exceptionFactory: (error) => new BadRequestException(error),
  });
}

function validateFile(file: UploadedRoadmapFile): void {
  if (!/\.(xlsx|xls)$/i.test(file.originalname)) {
    throw new BadRequestException("roadmap_file_extension_invalid");
  }
}

function requireActor(request: AuthenticatedRequest): string {
  if (!request.user) throw new BadRequestException("user_not_found_in_request");
  return request.user.id;
}

function parseImportDecisions(value: unknown) {
  if (value === undefined || value === null || value === "") return {};
  let parsedValue: unknown = value;
  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      throw new BadRequestException("roadmap_import_decisions_invalid");
    }
  }
  const result = RoadmapImportCommitSchema.safeParse(parsedValue);
  if (!result.success) throw new BadRequestException("roadmap_import_decisions_invalid");
  return result.data.decisions;
}
