import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { CreateQuestionSchema, ReorderSurveyQuestionsSchema, UpdateQuestionSchema } from "@soc/contracts";
import type { ReorderSurveyQuestionsRequest } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveyQuestionsService } from "./survey-questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

@Controller("surveys/:surveyId/sections/:sectionId/questions")
@RequirePermissions(Permissions.MANAGE_SURVEY)
export class SurveyQuestionsController {
  constructor(private readonly questionsService: SurveyQuestionsService) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(CreateQuestionSchema)) dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(surveyId, sectionId, dto, req.user.id);
  }

  @Patch("reorder")
  reorder(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(ReorderSurveyQuestionsSchema)) dto: ReorderSurveyQuestionsRequest,
  ) {
    return this.questionsService.reorder(surveyId, sectionId, dto, req.user.id);
  }

  @Patch(":questionId")
  update(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body(new ZodValidationPipe(UpdateQuestionSchema)) dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(surveyId, sectionId, questionId, dto, req.user.id);
  }

  @Delete(":questionId")
  delete(
    @Req() req: AuthedRequest,
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
  ) {
    return this.questionsService.delete(surveyId, sectionId, questionId, req.user.id);
  }
}
