import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { isoToMs, nowMs } from "@soc/shared";
import { Permissions } from "@soc/contracts";

import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";

import type { SurveyRecordWithState } from "./entities/survey.entity";
import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { CreateSurveyDto } from "./dto/create-survey.dto";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";
import type { ComputedSurveyState, SurveyDetailResponse } from "@soc/contracts";

interface SurveyCaller {
  id: string;
  permission: number;
}

@Injectable()
export class SurveysService {
  constructor(
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly responsesRepo: SurveyResponsesRepository,
  ) {}

  private computeState(survey: {
    isPublished: boolean;
    opensAt: string | null;
    closesAt: string | null;
  }): ComputedSurveyState {
    if (!survey.isPublished) {
      return "closed";
    }

    const now = nowMs();

    if (survey.opensAt && isoToMs(survey.opensAt) > now) {
      return "before_open";
    }
    if (survey.closesAt && isoToMs(survey.closesAt) <= now) {
      return "closed";
    }

    return "open";
  }

  private hasManageSurvey(caller?: { permission: number }): boolean {
    return Boolean(
      caller && Permissions.has(caller.permission, Permissions.MANAGE_SURVEY),
    );
  }

  async findAll(): Promise<SurveyRecordWithState[]> {
    const surveys = await this.surveysRepo.findAll();
    const responseCounts = await Promise.all(
      surveys.map(async (survey) => ({
        surveyId: survey.id,
        responseCount: await this.responsesRepo.countSubmitted(survey.id),
      })),
    );

    const responseCountMap = new Map(responseCounts.map((item) => [item.surveyId, item.responseCount]));

    return surveys.map((s) => {
      const computedState = this.computeState(s);
      return { ...s, computedState, responseCount: responseCountMap.get(s.id) ?? 0 };
    });
  }

  async findPublished(): Promise<SurveyRecordWithState[]> {
    const surveys = await this.surveysRepo.findPublished();
    const responseCounts = await Promise.all(
      surveys.map(async (survey) => ({
        surveyId: survey.id,
        responseCount: await this.responsesRepo.countSubmitted(survey.id),
      })),
    );

    const responseCountMap = new Map(responseCounts.map((item) => [item.surveyId, item.responseCount]));

    return surveys.map((s) => {
      const computedState = this.computeState(s);
      return { ...s, computedState, responseCount: responseCountMap.get(s.id) ?? 0 };
    });
  }

  async findById(id: string): Promise<SurveyRecordWithState> {
    const survey = await this.surveysRepo.findById(id);
    if (!survey) throw new NotFoundException("survey_not_found");
    const computedState = this.computeState(survey);
    return { ...survey, computedState };
  }

  async findDetail(id: string, caller?: SurveyCaller): Promise<SurveyDetailResponse> {
    const survey = await this.findById(id);
    const isManagerPreview = !survey.isPublished && this.hasManageSurvey(caller);

    if (!survey.isPublished && !isManagerPreview) {
      throw new NotFoundException("survey_not_found");
    }

    const sections = await this.sectionsRepo.findBySurveyId(id);

    const sectionsWithQuestions = await Promise.all(
      sections.map(async (section) => {
        const questions = await this.questionsRepo.findBySectionId(section.id);
        return { ...section, questions };
      }),
    );

    const existingResponse = caller?.id
      ? await this.responsesRepo.findByUserAndSurvey(id, caller.id)
      : null;
    const currentResponse = existingResponse
      ? {
          ...existingResponse,
          answers: await this.responsesRepo.findAnswersByResponseId(existingResponse.id),
        }
      : null;

    return {
      ...survey,
      sections: sectionsWithQuestions,
      currentResponse,
      hasSubmitted: Boolean(existingResponse),
      isPreview: isManagerPreview,
    };
  }

  async create(creatorId: string, dto: CreateSurveyDto): Promise<SurveyRecordWithState> {
    const survey = await this.surveysRepo.insert(creatorId, dto);
    const computedState = this.computeState(survey);
    return { ...survey, computedState, responseCount: 0 };
  }

  async update(id: string, dto: UpdateSurveyDto): Promise<SurveyRecordWithState> {
    const current = await this.surveysRepo.findById(id);
    if (!current) throw new NotFoundException("survey_not_found");

    const survey = await this.surveysRepo.update(id, dto);
    if (!survey) throw new NotFoundException("survey_not_found");
    const computedState = this.computeState(survey);
    return { ...survey, computedState, responseCount: current.responseCount ?? 0 };
  }

  async delete(id: string): Promise<void> {
    const survey = await this.surveysRepo.findById(id);
    if (!survey) throw new NotFoundException("survey_not_found");
    await this.surveysRepo.delete(id);
  }

  async duplicate(id: string, creatorId: string): Promise<SurveyRecordWithState> {
    const original = await this.findDetail(id);

    const newSurvey = await this.surveysRepo.insert(creatorId, {
      kind: original.kind,
      titleKo: `${original.titleKo} (복사본)`,
      titleEn: original.titleEn ? `${original.titleEn} (Copy)` : undefined,
      descriptionKo: original.descriptionKo ?? undefined,
      descriptionEn: original.descriptionEn ?? undefined,
      feeRequirementPolicy: original.feePayersOnly ? "PAID_ONLY" : "NONE",
      allowMultipleResponses: original.allowMultipleResponses,
      allowResponseEdit: original.allowResponseEdit,
      isKoreanOnly: original.isKoreanOnly,
      isPublished: false,
      resultVisibility: original.resultVisibility,
      maxResponseCount: original.maxResponses ?? undefined,
      openAt: original.opensAt ?? undefined,
      closeAt: original.closesAt ?? undefined,
      connectedArticleId: original.connectedPostId ?? undefined,
    });

    for (const section of original.sections) {
      const newSection = await this.sectionsRepo.insert(newSurvey.id, {
        titleKo: section.titleKo,
        titleEn: section.titleEn ?? undefined,
        descriptionKo: section.descriptionKo ?? undefined,
        descriptionEn: section.descriptionEn ?? undefined,
        sortOrder: section.sortOrder,
      });

      for (const question of section.questions) {
        await this.questionsRepo.insert(newSection.id, {
          titleKo: question.titleKo,
          titleEn: question.titleEn ?? undefined,
          descriptionKo: question.descriptionKo ?? undefined,
          descriptionEn: question.descriptionEn ?? undefined,
          questionType: question.questionType,
          options: question.options ?? undefined,
          answerRegex: question.answerRegex ?? undefined,
          isRequired: question.isRequired,
          editDeadlineAt: question.editDeadlineAt ?? undefined,
          sortOrder: question.sortOrder,
        });
      }
    }

    const computedState = this.computeState(newSurvey);
    return { ...newSurvey, computedState, responseCount: 0 };
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

  async getAnalytics(
    surveyId: string,
    caller?: { id: string; permission: number },
  ) {
    const survey = await this.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    const hasAdminPermission =
      caller && Permissions.has(caller.permission, Permissions.MANAGE_SURVEY);

    if (!survey.isPublished && !hasAdminPermission) {
      throw new NotFoundException("survey_not_found");
    }

    if (survey.resultVisibility !== "PUBLIC" && !hasAdminPermission) {
      throw new ForbiddenException("analytics_access_forbidden");
    }

    const totalResponses = await this.responsesRepo.countSubmitted(surveyId);

    const sections = await this.sectionsRepo.findBySurveyId(surveyId);
    const answers = await this.responsesRepo.findAnswersBySurveyId(surveyId);

    const questionsAnalytics = await Promise.all(
      sections.map(async (section) => {
        const questions = await this.questionsRepo.findBySectionId(section.id);
        return Promise.all(
          questions.map(async (q) => {
            const questionAnswers = answers.filter((a) => a.questionId === q.id);
            const totalAnswers = questionAnswers.length;

            const isChoice =
              q.questionType === "single_choice" ||
              q.questionType === "multiple_choice" ||
              q.questionType === "dropdown";

            if (isChoice) {
              const options = (q.options as Array<{
                value: string;
                labelKo: string;
                labelEn?: string;
              }>) || [];

              const choiceCounts: Record<string, number> = {};
              for (const opt of options) {
                choiceCounts[opt.value] = 0;
              }

              for (const ans of questionAnswers) {
                const content = ans.content as Record<string, unknown>;
                if (q.questionType === "multiple_choice") {
                  const values = (content.values as string[]) || [];
                  for (const val of values) {
                    choiceCounts[val] = (choiceCounts[val] ?? 0) + 1;
                  }
                } else {
                  const val = content.value as string;
                  if (val !== undefined) {
                    choiceCounts[val] = (choiceCounts[val] ?? 0) + 1;
                  }
                }
              }

              const choices = options.map((opt) => {
                const count = choiceCounts[opt.value] ?? 0;
                const percentage =
                  totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
                return {
                  value: opt.value,
                  labelKo: opt.labelKo,
                  labelEn: opt.labelEn || null,
                  count,
                  percentage: Math.round(percentage * 10) / 10,
                };
              });

              return {
                questionId: q.id,
                questionType: q.questionType,
                titleKo: q.titleKo,
                titleEn: q.titleEn,
                totalAnswers,
                choices,
              };
            } else {
              const texts = questionAnswers.map((ans) => {
                const content = ans.content as Record<string, unknown>;
                if ("text" in content) return String(content.text);
                if ("value" in content) return String(content.value);
                if ("date" in content) return String(content.date);
                if ("time" in content) return String(content.time);
                if ("datetime" in content) return String(content.datetime);
                return JSON.stringify(content);
              });

              return {
                questionId: q.id,
                questionType: q.questionType,
                titleKo: q.titleKo,
                titleEn: q.titleEn,
                totalAnswers,
                texts,
              };
            }
          }),
        );
      }),
    );

    return {
      surveyId: survey.id,
      kind: survey.kind,
      resultVisibility: survey.resultVisibility,
      feePayersOnly: survey.feePayersOnly,
      allowMultipleResponses: survey.allowMultipleResponses,
      isKoreanOnly: survey.isKoreanOnly,
      descriptionKo: survey.descriptionKo,
      descriptionEn: survey.descriptionEn,
      computedState: survey.computedState,
      opensAt: survey.opensAt,
      closesAt: survey.closesAt,
      titleKo: survey.titleKo,
      titleEn: survey.titleEn,
      totalResponses,
      questions: questionsAnalytics.flat(2),
    };
  }
}
