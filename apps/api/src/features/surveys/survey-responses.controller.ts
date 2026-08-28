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
import { SubmitResponseSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { Request } from "express";

import { OptionalAuthGuard, RequireAnyPermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveyResponsesService } from "./survey-responses.service";
import { SubmitResponseDto } from "./dto/submit-response.dto";

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
    @Body(new ZodValidationPipe(SubmitResponseSchema)) dto: SubmitResponseDto,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.submit(surveyId, dto, req.user);
  }

  @Get()
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  findAll(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.responsesService.findAll(surveyId, req.user);
  }

  @Get("mine")
  @UseGuards(OptionalAuthGuard)
  findMine(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.findMine(surveyId, req.user);
  }

  @Patch("mine")
  @UseGuards(OptionalAuthGuard)
  updateMine(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(SubmitResponseSchema)) dto: SubmitResponseDto,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.updateMine(surveyId, dto, req.user);
  }

  @Get("with-answers")
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  findAllWithAnswers(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.responsesService.findAllWithAnswers(surveyId, req.user);
  }

  @Get(":responseId")
  @RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
  findDetail(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.responsesService.findDetail(surveyId, responseId, req.user);
  }
}
