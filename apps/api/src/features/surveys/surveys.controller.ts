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

import { RequirePermissions } from "../../shared/guards";
import { Permissions } from "@soc/contracts";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveysService } from "./surveys.service";
import { CreateSurveyDto } from "./dto/create-survey.dto";
import { UpdateSurveyDto } from "./dto/update-survey.dto";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

@Controller("surveys")
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get()
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAll() {
    return this.surveysService.findAll();
  }

  @Get(":id")
  findDetail(@Param("id", ParseUUIDPipe) id: string) {
    return this.surveysService.findDetail(id);
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
}
