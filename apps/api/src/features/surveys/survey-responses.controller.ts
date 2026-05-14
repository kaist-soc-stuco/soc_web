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
import { SubmitResponseSchema, ReviewResponseSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { Request } from "express";

import { OptionalAuthGuard, RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

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

  @Get(":responseId")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findDetail(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
  ) {
    return this.responsesService.findDetail(surveyId, responseId);
  }

  @Patch(":responseId/review")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  review(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
    @Body(new ZodValidationPipe(ReviewResponseSchema)) dto: ReviewResponseDto,
    @Req() req: AuthedRequest,
  ) {
    return this.responsesService.review(surveyId, responseId, req.user.id, dto);
  }
}
