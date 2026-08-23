import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyMutationPolicy } from "./survey-mutation-policy";

import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { CreateQuestionDto } from "./dto/create-question.dto";
import type { UpdateQuestionDto } from "./dto/update-question.dto";
import {
  assertSurveyBranchDefinitions,
  assertSurveyQuestionDefinition,
} from "./survey-definition-validation";
import type { ReorderSurveyQuestionsRequest } from "@soc/contracts";

@Injectable()
export class SurveyQuestionsService {
  constructor(
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly mutationPolicy: SurveyMutationPolicy,
  ) {}

  async create(
    surveyId: string,
    sectionId: string,
    dto: CreateQuestionDto,
  ): Promise<SurveyQuestionRecord> {
    return this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      const question = await this.questionsRepo.insert(sectionId, dto, tx);
      assertSurveyQuestionDefinition(question);
      if (
        typeof (
          this.sectionsRepo as unknown as {
            findBySurveyId?: unknown;
          }
        ).findBySurveyId === "function"
      ) {
        const sections = await this.sectionsRepo.findBySurveyId(surveyId, tx);
        const withQuestions = await Promise.all(sections.map(async (item) => ({
          ...item,
          questions: await this.questionsRepo.findBySectionId(item.id, tx),
        })));
        assertSurveyBranchDefinitions(withQuestions);
      }
      return question;
    });
  }

  async update(
    surveyId: string,
    sectionId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<SurveyQuestionRecord> {
    return this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      const question = await this.questionsRepo.update(
        questionId,
        sectionId,
        dto,
        tx,
      );
      if (!question) throw new NotFoundException("question_not_found");
      assertSurveyQuestionDefinition(question);
      if (
        typeof (
          this.sectionsRepo as unknown as {
            findBySurveyId?: unknown;
          }
        ).findBySurveyId === "function"
      ) {
        const sections = await this.sectionsRepo.findBySurveyId(surveyId, tx);
        const withQuestions = await Promise.all(sections.map(async (item) => ({
          ...item,
          questions: await this.questionsRepo.findBySectionId(item.id, tx),
        })));
        assertSurveyBranchDefinitions(withQuestions);
      }
      return question;
    });
  }

  async delete(surveyId: string, sectionId: string, questionId: string): Promise<void> {
    await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      const question = await this.questionsRepo.findById(questionId, sectionId, tx);
      if (!question) throw new NotFoundException("question_not_found");
      await this.questionsRepo.delete(questionId, sectionId, tx);
    });
  }

  async reorder(
    surveyId: string,
    sectionId: string,
    input: ReorderSurveyQuestionsRequest,
  ): Promise<SurveyQuestionRecord[]> {
    return this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      const existing = await this.questionsRepo.findBySectionId(sectionId, tx);
      const existingIds = new Set(existing.map((question) => question.id));
      if (
        existing.length !== input.items.length ||
        input.items.some((item) => !existingIds.has(item.id))
      ) {
        throw new BadRequestException("survey_question_reorder_must_include_all_questions");
      }
      const reordered = await this.questionsRepo.reorder(sectionId, input.items, tx);
      return reordered.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    });
  }
}
