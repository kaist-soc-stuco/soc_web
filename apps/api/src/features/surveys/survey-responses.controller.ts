import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SubmitResponseSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { Request } from "express";

import { OptionalAuthGuard, RequirePermissions } from "../../shared/guards";
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
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAll(@Param("surveyId", ParseUUIDPipe) surveyId: string) {
    return this.responsesService.findAll(surveyId);
  }

  @Get("with-answers")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAllWithAnswers(@Param("surveyId", ParseUUIDPipe) surveyId: string) {
    return this.responsesService.findAllWithAnswers(surveyId);
  }

  @Get(":responseId")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findDetail(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
  ) {
    return this.responsesService.findDetail(surveyId, responseId);
  }
}
