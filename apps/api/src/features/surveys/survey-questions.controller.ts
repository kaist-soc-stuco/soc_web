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
import { CreateQuestionSchema, ReorderSurveyQuestionsSchema, UpdateQuestionSchema } from "@soc/contracts";
import type { ReorderSurveyQuestionsRequest } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequireAnyPermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveyQuestionsService } from "./survey-questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";

@Controller("surveys/:surveyId/sections/:sectionId/questions")
@RequireAnyPermissions(Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL)
export class SurveyQuestionsController {
  constructor(private readonly questionsService: SurveyQuestionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(CreateQuestionSchema)) dto: CreateQuestionDto,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.questionsService.create(surveyId, sectionId, dto, request.user);
  }

  @Patch("reorder")
  reorder(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(ReorderSurveyQuestionsSchema)) dto: ReorderSurveyQuestionsRequest,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.questionsService.reorder(surveyId, sectionId, dto, request.user);
  }

  @Patch(":questionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body(new ZodValidationPipe(UpdateQuestionSchema)) dto: UpdateQuestionDto,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.questionsService.update(surveyId, sectionId, questionId, dto, request.user);
  }

  @Delete(":questionId")
  delete(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Req() request: { user: { id: string; permission: number } },
  ) {
    return this.questionsService.delete(surveyId, sectionId, questionId, request.user);
  }
}
