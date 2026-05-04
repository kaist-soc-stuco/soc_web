import { Injectable, NotFoundException } from "@nestjs/common";
import { isoToMs, isExpired, nowMs } from "@soc/shared";

import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";

import type { SurveyRecordWithState } from "./entities/survey.entity";
import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { CreateSurveyDto } from "./dto/create-survey.dto";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";
import type { ComputedSurveyState, SurveyDetailResponse } from "@soc/contracts";

@Injectable()
export class SurveysService {
  constructor(
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
  ) {}

  private computeState(survey: {
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  }): ComputedSurveyState {
    const now = nowMs();
    if (survey.opensAt && isoToMs(survey.opensAt) > now) return "before_open";
    if (survey.closesAt && isExpired(isoToMs(survey.closesAt))) return "closed";
    if (survey.status === "open") return "open";
    return "closed";
  }

  async findAll(): Promise<SurveyRecordWithState[]> {
    const surveys = await this.surveysRepo.findAll();
    return surveys.map((s) => ({ ...s, computedState: this.computeState(s) }));
  }

  async findById(id: string): Promise<SurveyRecordWithState> {
    const survey = await this.surveysRepo.findById(id);
    if (!survey) throw new NotFoundException("survey_not_found");
    return { ...survey, computedState: this.computeState(survey) };
  }

  async findDetail(id: string): Promise<SurveyDetailResponse> {
    const survey = await this.findById(id);
    const sections = await this.sectionsRepo.findBySurveyId(id);

    const sectionsWithQuestions = await Promise.all(
      sections.map(async (section) => {
        const questions = await this.questionsRepo.findBySectionId(section.id);
        return { ...section, questions };
      }),
    );

    return { ...survey, sections: sectionsWithQuestions };
  }

  async create(creatorId: string, dto: CreateSurveyDto): Promise<SurveyRecordWithState> {
    const survey = await this.surveysRepo.insert(creatorId, dto);
    return { ...survey, computedState: this.computeState(survey) };
  }

  async update(id: string, dto: UpdateSurveyDto): Promise<SurveyRecordWithState> {
    const survey = await this.surveysRepo.update(id, dto);
    if (!survey) throw new NotFoundException("survey_not_found");
    return { ...survey, computedState: this.computeState(survey) };
  }

  async delete(id: string): Promise<void> {
    const survey = await this.surveysRepo.findById(id);
    if (!survey) throw new NotFoundException("survey_not_found");
    await this.surveysRepo.delete(id);
  }

  async findSectionWithQuestions(
    surveyId: string,
    sectionId: string,
  ): Promise<SurveySectionRecord & { questions: SurveyQuestionRecord[] }> {
    const section = await this.sectionsRepo.findById(sectionId, surveyId);
    if (!section) throw new NotFoundException("section_not_found");
    const questions = await this.questionsRepo.findBySectionId(sectionId);
    return { ...section, questions };
  }
}
