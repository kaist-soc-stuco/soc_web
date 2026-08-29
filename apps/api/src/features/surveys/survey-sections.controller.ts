import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { CreateSectionSchema, ReorderSurveySectionsSchema, UpdateSectionSchema } from "@soc/contracts";
import type { ReorderSurveySectionsRequest } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveySectionsService } from "./survey-sections.service";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

@Controller("surveys/:surveyId/sections")
@RequirePermissions(Permissions.MANAGE_SURVEY)
export class SurveySectionsController {
  constructor(private readonly sectionsService: SurveySectionsService) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(CreateSectionSchema)) dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(surveyId, dto, req.user.id);
  }

  @Patch("reorder")
  reorder(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(ReorderSurveySectionsSchema)) dto: ReorderSurveySectionsRequest,
  ) {
    return this.sectionsService.reorder(surveyId, dto, req.user.id);
  }

  @Patch(":sectionId")
  update(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(UpdateSectionSchema)) dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(surveyId, sectionId, dto, req.user.id);
  }

  @Delete(":sectionId")
  delete(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
  ) {
    return this.sectionsService.delete(surveyId, sectionId, req.user.id);
  }
}
