import { nowDate } from "@soc/shared";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { surveyStructureSnapshot, surveyStructuresEqual, type RestoreSurveyStructureRequest } from "@soc/contracts";
import { surveys, surveyAnswers, surveyQuestions, surveySections } from "../../infrastructure/postgres/postgres.schema";
import { SurveyMutationPolicy } from "./survey-mutation-policy";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { AssetRepository } from "../asset/repositories/asset.repository";
import { AuditLogService } from "../audit/audit-log.service";
import { assertSurveyAssetReferences } from "./survey-asset-access";
import { assertSurveyBranchDefinitions, assertSurveyQuestionDefinition } from "./survey-definition-validation";
import { sanitizeSurveyRichText } from "./survey-rich-text";

@Injectable()
export class SurveyHistoryService {
  constructor(
    private readonly policy: SurveyMutationPolicy,
    private readonly sections: SurveySectionsRepository,
    private readonly questions: SurveyQuestionsRepository,
    private readonly assets: AssetRepository,
    private readonly audit: AuditLogService,
  ) {}

  async restore(surveyId: string, input: RestoreSurveyStructureRequest, actorUserId: string) {
    const result = await this.policy.withStructureMutation(surveyId, async tx => {
      const read = async () => Promise.all((await this.sections.findBySurveyId(surveyId, tx)).map(async section => ({
        ...section, questions: await this.questions.findBySectionId(section.id, tx),
      })));
      const current = await read();
      if (!surveyStructuresEqual(surveyStructureSnapshot(current), input.expected)) {
        throw new ConflictException("survey_history_conflict");
      }
      const target = surveyStructureSnapshot(input.sections);
      const currentSections = new Set(current.map(s => s.id));
      const currentQuestions = new Set(current.flatMap(s => s.questions.map(q => q.id)));
      const nextQuestions = new Set(target.flatMap(s => s.questions.map(q => q.id)));
      const removedQuestions = [...currentQuestions].filter(id => !nextQuestions.has(id));
      if (removedQuestions.length && (await tx.select({ id: surveyAnswers.id }).from(surveyAnswers)
        .where(inArray(surveyAnswers.questionId, removedQuestions)).limit(1)).length) {
        throw new ConflictException("survey_history_question_has_answers");
      }
      // Never let caller-supplied IDs overwrite a section/question owned by another survey.
      const newSectionIds = target.map(s => s.id).filter(id => !currentSections.has(id));
      const newQuestionIds = [...nextQuestions].filter(id => !currentQuestions.has(id));
      if (newSectionIds.length && (await tx.select({ id: surveySections.id }).from(surveySections).where(inArray(surveySections.id, newSectionIds)).limit(1)).length
        || newQuestionIds.length && (await tx.select({ id: surveyQuestions.id }).from(surveyQuestions).where(inArray(surveyQuestions.id, newQuestionIds)).limit(1)).length) {
        throw new BadRequestException("survey_history_id_conflict");
      }
      await assertSurveyAssetReferences(this.assets, actorUserId, target, tx, surveyId);
      if (input.header) {
        const [currentHeader] = await tx.select({ titleKo: surveys.titleKo, titleEn: surveys.titleEn, descriptionKo: surveys.descriptionKo, descriptionEn: surveys.descriptionEn }).from(surveys).where(eq(surveys.surveyId, surveyId));
        if (Object.entries(input.header.expected).some(([key, value]) => (currentHeader[key as keyof typeof currentHeader] ?? "") !== value)) {
          throw new ConflictException("survey_history_conflict");
        }
        await assertSurveyAssetReferences(this.assets, actorUserId, input.header.value, tx, surveyId);
        await tx.update(surveys).set({ ...input.header.value, descriptionKo: sanitizeSurveyRichText(input.header.value.descriptionKo), descriptionEn: sanitizeSurveyRichText(input.header.value.descriptionEn), updatedAt: nowDate() }).where(eq(surveys.surveyId, surveyId));
      }
      for (const section of target) {
        const { questions: _questions, ...fields } = section;
        const values = { ...fields, surveyId, descriptionKo: sanitizeSurveyRichText(fields.descriptionKo), descriptionEn: sanitizeSurveyRichText(fields.descriptionEn), updatedAt: nowDate() };
        if (currentSections.has(section.id)) await tx.update(surveySections).set(values).where(and(eq(surveySections.id, section.id), eq(surveySections.surveyId, surveyId)));
        else await tx.insert(surveySections).values(values);
      }
      for (const section of target) for (const question of section.questions) {
        const values = { ...question, sectionId: section.id, descriptionKo: sanitizeSurveyRichText(question.descriptionKo), descriptionEn: sanitizeSurveyRichText(question.descriptionEn), updatedAt: nowDate() };
        if (currentQuestions.has(question.id)) await tx.update(surveyQuestions).set(values).where(eq(surveyQuestions.id, question.id));
        else await tx.insert(surveyQuestions).values(values);
      }
      if (removedQuestions.length) await tx.delete(surveyQuestions).where(inArray(surveyQuestions.id, removedQuestions));
      const removedSections = [...currentSections].filter(id => !target.some(section => section.id === id));
      if (removedSections.length) await tx.delete(surveySections).where(inArray(surveySections.id, removedSections));
      const restored = await read();
      restored.forEach(section => section.questions.forEach(assertSurveyQuestionDefinition));
      assertSurveyBranchDefinitions(restored);
      return restored;
    });
    await this.audit.record({ action: "survey.structure.restore", actorUserId, targetId: surveyId, targetType: "survey", payload: { sectionCount: result.length } });
    return result;
  }
}
