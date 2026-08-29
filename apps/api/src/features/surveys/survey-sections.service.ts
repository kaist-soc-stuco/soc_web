import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";

import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyMutationPolicy } from "./survey-mutation-policy";

import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { UpdateSectionDto } from "./dto/update-section.dto";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import type { ReorderSurveySectionsRequest } from "@soc/contracts";
import { assertSurveyBranchDefinitions } from "./survey-definition-validation";
import { AuditLogService } from "../audit/audit-log.service";

const surveySectionAuditSnapshot = (section: SurveySectionRecord): Record<string, unknown> => ({
  id: section.id,
  surveyId: section.surveyId,
  titleKo: section.titleKo,
  titleEn: section.titleEn,
  sortOrder: section.sortOrder,
});

@Injectable()
export class SurveySectionsService {
  constructor(
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly mutationPolicy: SurveyMutationPolicy,
    @Optional() private readonly questionsRepo?: SurveyQuestionsRepository,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  private async assertBranchDefinitions(surveyId: string, tx: Parameters<SurveySectionsRepository["findBySurveyId"]>[1]) {
    if (!this.questionsRepo) return;
    const sections = await this.sectionsRepo.findBySurveyId(surveyId, tx);
    const withQuestions = await Promise.all(sections.map(async (section) => ({
      ...section,
      questions: await this.questionsRepo!.findBySectionId(section.id, tx),
    })));
    assertSurveyBranchDefinitions(withQuestions);
  }

  async create(
    surveyId: string,
    dto: CreateSectionDto,
    actorUserId?: string,
  ): Promise<SurveySectionRecord> {
    const created = await this.mutationPolicy.withStructureMutation(surveyId, (tx) =>
      this.sectionsRepo.insert(surveyId, dto, tx),
    );
    await this.auditLogService?.record({
      action: "survey.section.create",
      actorUserId: actorUserId ?? null,
      targetId: created.id,
      targetType: "survey_section",
      payload: { created: surveySectionAuditSnapshot(created) },
    });
    return created;
  }

  async update(
    surveyId: string,
    sectionId: string,
    dto: UpdateSectionDto,
    actorUserId?: string,
  ): Promise<SurveySectionRecord> {
    const updated = await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.update(
        sectionId,
        surveyId,
        dto,
        tx,
      );
      if (!section) throw new NotFoundException("section_not_found");
      if (dto.sortOrder !== undefined) {
        await this.assertBranchDefinitions(surveyId, tx);
      }
      return section;
    });
    await this.auditLogService?.record({
      action: "survey.section.update",
      actorUserId: actorUserId ?? null,
      targetId: updated.id,
      targetType: "survey_section",
      payload: { after: surveySectionAuditSnapshot(updated) },
    });
    return updated;
  }

  async delete(surveyId: string, sectionId: string, actorUserId?: string): Promise<void> {
    let deletedSection: SurveySectionRecord | null = null;
    await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");
      deletedSection = section;

      if (this.questionsRepo) {
        const siblingSections = await this.sectionsRepo.findBySurveyId(surveyId, tx);
        const siblingQuestions = await Promise.all(
          siblingSections
            .filter((item) => item.id !== sectionId)
            .map((item) => this.questionsRepo!.findBySectionId(item.id, tx)),
        );
        const hasBranchReference = siblingQuestions.flat().some((question) =>
          Object.values(question.config?.goToSectionByValue ?? {}).includes(sectionId),
        );
        if (hasBranchReference) {
          throw new ConflictException("survey_branch_target_section_in_use");
        }
      }
      await this.sectionsRepo.delete(sectionId, surveyId, tx);
    });
    await this.auditLogService?.record({
      action: "survey.section.delete",
      actorUserId: actorUserId ?? null,
      targetId: sectionId,
      targetType: "survey_section",
      payload: deletedSection
        ? { deleted: surveySectionAuditSnapshot(deletedSection) }
        : undefined,
    });
  }

  async reorder(
    surveyId: string,
    input: ReorderSurveySectionsRequest,
    actorUserId?: string,
  ): Promise<SurveySectionRecord[]> {
    const reordered = await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const existing = await this.sectionsRepo.findBySurveyId(surveyId, tx);
      const existingIds = new Set(existing.map((section) => section.id));
      if (
        existing.length !== input.items.length ||
        input.items.some((item) => !existingIds.has(item.id))
      ) {
        throw new BadRequestException("survey_section_reorder_must_include_all_sections");
      }
      const reordered = await this.sectionsRepo.reorder(surveyId, input.items, tx);
      await this.assertBranchDefinitions(surveyId, tx);
      return reordered.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    });
    await this.auditLogService?.record({
      action: "survey.section.reorder",
      actorUserId: actorUserId ?? null,
      targetId: surveyId,
      targetType: "survey",
      payload: { surveyId, count: reordered.length },
    });
    return reordered;
  }
}
