import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";

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
import { AuditLogService } from "../audit/audit-log.service";

const surveyQuestionAuditSnapshot = (question: SurveyQuestionRecord): Record<string, unknown> => ({
  id: question.id,
  sectionId: question.sectionId,
  titleKo: question.titleKo,
  titleEn: question.titleEn,
  questionType: question.questionType,
  optionCount: question.options?.length ?? 0,
  isRequired: question.isRequired,
  answerRegexEnabled: Boolean(question.answerRegex),
  sortOrder: question.sortOrder,
});

@Injectable()
export class SurveyQuestionsService {
  constructor(
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly mutationPolicy: SurveyMutationPolicy,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  async create(
    surveyId: string,
    sectionId: string,
    dto: CreateQuestionDto,
    actorUserId?: string,
  ): Promise<SurveyQuestionRecord> {
    const question = await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
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
    await this.auditLogService?.record({
      action: "survey.question.create",
      actorUserId: actorUserId ?? null,
      targetId: question.id,
      targetType: "survey_question",
      payload: {
        surveyId,
        created: surveyQuestionAuditSnapshot(question),
      },
    });
    return question;
  }

  async update(
    surveyId: string,
    sectionId: string,
    questionId: string,
    dto: UpdateQuestionDto,
    actorUserId?: string,
  ): Promise<SurveyQuestionRecord> {
    const updated = await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
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
    await this.auditLogService?.record({
      action: "survey.question.update",
      actorUserId: actorUserId ?? null,
      targetId: updated.id,
      targetType: "survey_question",
      payload: {
        surveyId,
        after: surveyQuestionAuditSnapshot(updated),
      },
    });
    return updated;
  }

  async delete(
    surveyId: string,
    sectionId: string,
    questionId: string,
    actorUserId?: string,
  ): Promise<void> {
    let deletedQuestion: SurveyQuestionRecord | null = null;
    await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      const question = await this.questionsRepo.findById(questionId, sectionId, tx);
      if (!question) throw new NotFoundException("question_not_found");
      deletedQuestion = question;
      await this.questionsRepo.delete(questionId, sectionId, tx);
    });
    await this.auditLogService?.record({
      action: "survey.question.delete",
      actorUserId: actorUserId ?? null,
      targetId: questionId,
      targetType: "survey_question",
      payload: deletedQuestion
        ? { surveyId, deleted: surveyQuestionAuditSnapshot(deletedQuestion) }
        : undefined,
    });
  }

  async reorder(
    surveyId: string,
    sectionId: string,
    input: ReorderSurveyQuestionsRequest,
    actorUserId?: string,
  ): Promise<SurveyQuestionRecord[]> {
    const reordered = await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
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
    await this.auditLogService?.record({
      action: "survey.question.reorder",
      actorUserId: actorUserId ?? null,
      targetId: surveyId,
      targetType: "survey",
      payload: { surveyId, sectionId, count: reordered.length },
    });
    return reordered;
  }
}
