import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import { SurveyQuestionsService } from "./survey-questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";

@Controller("surveys/:surveyId/sections/:sectionId/questions")
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission(PermissionFlags.SURVEY_MANAGE)
export class SurveyQuestionsController {
  constructor(private readonly questionsService: SurveyQuestionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(surveyId, sectionId, dto);
  }

  @Patch(":questionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(surveyId, sectionId, questionId, dto);
  }

  @Delete(":questionId")
  delete(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
  ) {
    return this.questionsService.delete(surveyId, sectionId, questionId);
  }
}
