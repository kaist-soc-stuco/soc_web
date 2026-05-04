import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import { SurveySectionsService } from "./survey-sections.service";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";

@Controller("surveys/:surveyId/sections")
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission(PermissionFlags.SURVEY_MANAGE)
export class SurveySectionsController {
  constructor(private readonly sectionsService: SurveySectionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(surveyId, dto);
  }

  @Patch(":sectionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(surveyId, sectionId, dto);
  }

  @Delete(":sectionId")
  delete(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
  ) {
    return this.sectionsService.delete(surveyId, sectionId);
  }
}
