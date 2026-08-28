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
import { CreateSectionSchema, ReorderSurveySectionsSchema, UpdateSectionSchema } from "@soc/contracts";
import type { ReorderSurveySectionsRequest } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequireAnyPermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveySectionsService } from "./survey-sections.service";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";

@Controller("surveys/:surveyId/sections")
@RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
export class SurveySectionsController {
  constructor(private readonly sectionsService: SurveySectionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(CreateSectionSchema)) dto: CreateSectionDto,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.sectionsService.create(surveyId, dto, request.user);
  }

  @Patch("reorder")
  reorder(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(ReorderSurveySectionsSchema)) dto: ReorderSurveySectionsRequest,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.sectionsService.reorder(surveyId, dto, request.user);
  }

  @Patch(":sectionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(UpdateSectionSchema)) dto: UpdateSectionDto,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.sectionsService.update(surveyId, sectionId, dto, request.user);
  }

  @Delete(":sectionId")
  delete(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.sectionsService.delete(surveyId, sectionId, request.user);
  }
}
