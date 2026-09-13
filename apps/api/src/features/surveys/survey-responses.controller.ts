import {
  Body,
  Delete,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { SubmitResponseSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { Request } from "express";

import { OptionalAuthGuard, RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveyResponsesService } from "./survey-responses.service";
import { SubmitResponseDto } from "./dto/submit-response.dto";
import type { TemporaryAccessTokenClaims } from "../auth/auth.types";

interface MaybeAuthedRequest extends Request {
  user?: { id: string; permission: number };
  temporaryUser?: TemporaryAccessTokenClaims;
}

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

const getSurveyCaller = (request: MaybeAuthedRequest) =>
  request.user ??
  (request.temporaryUser
    ? { permission: 0, temporaryClaims: request.temporaryUser }
    : undefined);

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
    return this.responsesService.submit(surveyId, dto, getSurveyCaller(req));
  }

  @Get()
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAll(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") query?: string,
    @Query("sort") sortOrder?: "asc" | "desc",
  ) {
    return this.responsesService.findAll(surveyId, {
      page: Number(page),
      pageSize: Number(pageSize),
      query,
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });
  }

  @Get("mine")
  @Header("Cache-Control", "private, no-store")
  @UseGuards(OptionalAuthGuard)
  findMine(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.findMine(surveyId, getSurveyCaller(req));
  }

  @Patch("mine")
  @Header("Cache-Control", "private, no-store")
  @UseGuards(OptionalAuthGuard)
  updateMine(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Body(new ZodValidationPipe(SubmitResponseSchema)) dto: SubmitResponseDto,
    @Req() req: MaybeAuthedRequest,
  ) {
    return this.responsesService.updateMine(surveyId, dto, getSurveyCaller(req));
  }

  @Get("with-answers")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findAllWithAnswers(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") query?: string,
    @Query("sort") sortOrder?: "asc" | "desc",
  ) {
    return this.responsesService.findAllWithAnswers(surveyId, {
      page: Number(page),
      pageSize: Number(pageSize),
      query,
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });
  }

  @Get("email-notifications")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  emailSubscription(@Param("surveyId", ParseUUIDPipe) surveyId: string, @Req() req: AuthedRequest) {
    return this.responsesService.getEmailSubscription(surveyId, req.user.id);
  }

  @Patch("email-notifications")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  setEmailSubscription(@Param("surveyId", ParseUUIDPipe) surveyId: string, @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(z.object({ enabled: z.boolean() }))) dto: { enabled: boolean }) {
    return this.responsesService.setEmailSubscription(surveyId, req.user.id, dto.enabled);
  }

  @Delete()
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  deleteAll(@Param("surveyId", ParseUUIDPipe) surveyId: string, @Req() req: AuthedRequest) {
    return this.responsesService.deleteAll(surveyId, req.user.id);
  }

  @Get(":responseId")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  findDetail(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("responseId", ParseUUIDPipe) responseId: string,
  ) {
    return this.responsesService.findDetail(surveyId, responseId);
  }
}
