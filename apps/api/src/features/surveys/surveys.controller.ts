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

import { RequireAnyPermissions, OptionalAuthGuard } from "../auth/guards";
import { Permissions } from "@soc/contracts";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveysService } from "./surveys.service";
import { CreateSurveyDto } from "./dto/create-survey.dto";
import { UpdateSurveyDto } from "./dto/update-survey.dto";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

interface OptionalAuthedRequest extends Request {
  user?: { id: string; permission: number };
}

@Controller("surveys")
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get()
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  findAll(@Req() req: AuthedRequest) {
    return this.surveysService.findAll(req.user);
  }

  @Get("list/public")
  findPublic() {
    return this.surveysService.findPublished();
  }

  @Get(":id")
  @UseGuards(OptionalAuthGuard)
  findDetail(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.surveysService.findDetail(id, req.user);
  }

  @Get(":id/analytics")
  @UseGuards(OptionalAuthGuard)
  getAnalytics(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.surveysService.getAnalytics(id, req.user);
  }

  @Post()
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateSurveySchema)) dto: CreateSurveyDto,
  ) {
    return this.surveysService.create(req.user.id, dto, req.user);
  }

  @Patch(":id")
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSurveySchema)) dto: UpdateSurveyDto,
    @Req() req: AuthedRequest,
  ) {
    return this.surveysService.update(id, dto, req.user);
  }

  @Delete(":id")
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  delete(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.surveysService.delete(id, req.user);
  }

  @Post(":id/duplicate")
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  duplicate(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.surveysService.duplicate(id, req.user.id, req.user);
  }
}
