import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { AuthGuard, OptionalAuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import { SurveyResponsesService } from "./survey-responses.service";
import { SubmitResponseDto } from "./dto/submit-response.dto";
import { ReviewResponseDto } from "./dto/review-response.dto";

interface MaybeAuthedRequest extends Request {
  user?: { id: string; permission: number };
}

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

@Controller("surveys/:surveyId/responses")
export class SurveyResponsesController {
  constructor(private readonly responsesService: SurveyResponsesService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  submit(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body() dto: SubmitResponseDto,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.submit(surveyId, dto, req.user);
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  findAll(@Param("surveyId", ParseUUIDPipe) surveyId: string) {
    return this.responsesService.findAll(surveyId);
  }

  @Get(":responseId")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  findDetail(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
  ) {
    return this.responsesService.findDetail(surveyId, responseId);
  }

  @Patch(":responseId/review")
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission(PermissionFlags.SURVEY_MANAGE)
  review(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
    @Body() dto: ReviewResponseDto,
    @Req() req: AuthedRequest,
  ) {
    return this.responsesService.review(surveyId, responseId, req.user.id, dto);
  }
}
