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
import { Request } from "express";

import { AuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

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
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  findAll() {
    return this.surveysService.findAll();
  }

  @Get(":id")
  findDetail(@Param("id", ParseUUIDPipe) id: string) {
    return this.surveysService.findDetail(id);
  }

  @Post()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  create(@Req() req: AuthedRequest, @Body() dto: CreateSurveyDto) {
    return this.surveysService.create(req.user.id, dto);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveysService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.surveysService.delete(id);
  }
}
