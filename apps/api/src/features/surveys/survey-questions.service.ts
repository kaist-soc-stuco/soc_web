import { Injectable, NotFoundException } from "@nestjs/common";

import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";

import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { CreateQuestionDto } from "./dto/create-question.dto";
import type { UpdateQuestionDto } from "./dto/update-question.dto";

@Injectable()
export class SurveyQuestionsService {
  constructor(
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
  ) {}

  async create(
    surveyId: string,
    sectionId: string,
    dto: CreateQuestionDto,
  ): Promise<SurveyQuestionRecord> {
    const section = await this.sectionsRepo.findById(sectionId, surveyId);
    if (!section) throw new NotFoundException("section_not_found");
    return this.questionsRepo.insert(sectionId, dto);
  }

  async update(
    surveyId: string,
    sectionId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<SurveyQuestionRecord> {
    const section = await this.sectionsRepo.findById(sectionId, surveyId);
    if (!section) throw new NotFoundException("section_not_found");
    const question = await this.questionsRepo.update(questionId, sectionId, dto);
    if (!question) throw new NotFoundException("question_not_found");
    return question;
  }

  async delete(surveyId: string, sectionId: string, questionId: string): Promise<void> {
    const section = await this.sectionsRepo.findById(sectionId, surveyId);
    if (!section) throw new NotFoundException("section_not_found");
    const question = await this.questionsRepo.findById(questionId, sectionId);
    if (!question) throw new NotFoundException("question_not_found");
    await this.questionsRepo.delete(questionId, sectionId);
  }
}
