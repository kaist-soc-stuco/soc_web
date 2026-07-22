import { Injectable, NotFoundException } from "@nestjs/common";

import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyMutationPolicy } from "./survey-mutation-policy";

import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { UpdateSectionDto } from "./dto/update-section.dto";

@Injectable()
export class SurveySectionsService {
  constructor(
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly mutationPolicy: SurveyMutationPolicy,
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
      await this.sectionsRepo.delete(sectionId, surveyId, tx);
    });
  }
}
