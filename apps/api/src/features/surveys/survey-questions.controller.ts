import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CreateQuestionSchema, UpdateQuestionSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { SurveyQuestionsService } from "./survey-questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";

@Controller("surveys/:surveyId/sections/:sectionId/questions")
@RequirePermissions(Permissions.MANAGE_SURVEY)
export class SurveyQuestionsController {
  constructor(private readonly questionsService: SurveyQuestionsService) {}

  @Post()
  create(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Body(new ZodValidationPipe(CreateQuestionSchema)) dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(surveyId, sectionId, dto);
  }

  @Patch(":questionId")
  update(
    @Param("surveyId", ParseUUIDPipe) surveyId: string,
    @Param("sectionId", ParseUUIDPipe) sectionId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body(new ZodValidationPipe(UpdateQuestionSchema)) dto: UpdateQuestionDto,
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
