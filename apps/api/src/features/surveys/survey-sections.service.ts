import { ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";

import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyMutationPolicy } from "./survey-mutation-policy";

import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { UpdateSectionDto } from "./dto/update-section.dto";
import { SurveyQuestionsRepository } from "./survey-questions.repository";

@Injectable()
export class SurveySectionsService {
  constructor(
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly mutationPolicy: SurveyMutationPolicy,
    @Optional() private readonly questionsRepo?: SurveyQuestionsRepository,
  ) {}

  async create(surveyId: string, dto: CreateSectionDto): Promise<SurveySectionRecord> {
    return this.mutationPolicy.withStructureMutation(surveyId, (tx) =>
      this.sectionsRepo.insert(surveyId, dto, tx),
    );
  }

  async update(
    surveyId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ): Promise<SurveySectionRecord> {
    return this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.update(
        sectionId,
        surveyId,
        dto,
        tx,
      );
      if (!section) throw new NotFoundException("section_not_found");
      return section;
    });
  }

  async delete(surveyId: string, sectionId: string): Promise<void> {
    await this.mutationPolicy.withStructureMutation(surveyId, async (tx) => {
      const section = await this.sectionsRepo.findById(sectionId, surveyId, tx);
      if (!section) throw new NotFoundException("section_not_found");

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
  }
}
