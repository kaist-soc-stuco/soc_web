import { Injectable, NotFoundException } from "@nestjs/common";

import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveysRepository } from "./surveys.repository";

import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { UpdateSectionDto } from "./dto/update-section.dto";

@Injectable()
export class SurveySectionsService {
  constructor(
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly surveysRepo: SurveysRepository,
  ) {}

  async create(surveyId: string, dto: CreateSectionDto): Promise<SurveySectionRecord> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");
    return this.sectionsRepo.insert(surveyId, dto);
  }

  async update(
    surveyId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ): Promise<SurveySectionRecord> {
    const section = await this.sectionsRepo.update(sectionId, surveyId, dto);
    if (!section) throw new NotFoundException("section_not_found");
    return section;
  }

  async delete(surveyId: string, sectionId: string): Promise<void> {
    const section = await this.sectionsRepo.findById(sectionId, surveyId);
    if (!section) throw new NotFoundException("section_not_found");
    await this.sectionsRepo.delete(sectionId, surveyId);
  }
}
