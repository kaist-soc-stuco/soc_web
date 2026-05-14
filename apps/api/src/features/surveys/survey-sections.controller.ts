import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CreateSectionSchema, UpdateSectionSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveySectionsService } from "./survey-sections.service";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";

@Controller("surveys/:surveyId/sections")
@RequirePermissions(Permissions.MANAGE_SURVEY)
export class SurveySectionsController {
  constructor(private readonly sectionsService: SurveySectionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(CreateSectionSchema)) dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(surveyId, dto);
  }

  @Patch(":sectionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(UpdateSectionSchema)) dto: UpdateSectionDto,
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
