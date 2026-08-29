import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CreateSurveySchema, UpdateSurveySchema } from "@soc/contracts";
import { Request } from "express";

import { RequirePermissions, OptionalAuthGuard } from "../auth/guards";
import { Permissions } from "@soc/contracts";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveysService } from "./surveys.service";
import { CreateSurveyDto } from "./dto/create-survey.dto";
import { UpdateSurveyDto } from "./dto/update-survey.dto";
import { GoogleSurveySheetsService } from "./google-survey-sheets.service";
import type { TemporaryAccessTokenClaims } from "../auth/auth.types";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

interface OptionalAuthedRequest extends Request {
  user?: { id: string; permission: number };
  temporaryUser?: TemporaryAccessTokenClaims;
}

const getSurveyCaller = (request: OptionalAuthedRequest) =>
  request.user ??
  (request.temporaryUser
    ? { permission: 0, temporaryClaims: request.temporaryUser }
    : undefined);

@Controller("surveys")
export class SurveysController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly surveySheetsService: GoogleSurveySheetsService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAll() {
    return this.surveysService.findAll();
  }

  @Get("list/public")
  @UseGuards(OptionalAuthGuard)
  findPublic(@Req() req: OptionalAuthedRequest) {
    return this.surveysService.findPublished(getSurveyCaller(req));
  }

  @Get(":id")
  @UseGuards(OptionalAuthGuard)
  findDetail(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.surveysService.findDetail(id, getSurveyCaller(req));
  }

  @Get(":id/analytics")
  @UseGuards(OptionalAuthGuard)
  getAnalytics(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.surveysService.getAnalytics(id, getSurveyCaller(req));
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateSurveySchema)) dto: CreateSurveyDto,
  ) {
    return this.surveysService.create(req.user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSurveySchema)) dto: UpdateSurveyDto,
  ) {
    return this.surveysService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.surveysService.delete(id);
  }

  @Post(":id/duplicate")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  duplicate(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.surveysService.duplicate(id, req.user.id);
  }

  @Post(":id/spreadsheet")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  connectSpreadsheet(@Param("id", ParseUUIDPipe) id: string) {
    return this.surveySheetsService.connect(id);
  }

  @Post(":id/spreadsheet/sync")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  async syncSpreadsheet(@Param("id", ParseUUIDPipe) id: string) {
    await this.surveySheetsService.refresh(id, true);
    return this.surveysService.findById(id);
  }
}
