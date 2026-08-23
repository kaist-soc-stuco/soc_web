import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isoToMs, nowMs } from "@soc/shared";
import { Permissions } from "@soc/contracts";

import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveyMutationPolicy } from "./survey-mutation-policy";
import { assertPublishableSurveyDefinition } from "./survey-definition-validation";

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
    private readonly mutationPolicy: SurveyMutationPolicy,
  ) {}

  private computeState(survey: {
    isPublished: boolean;
    isAlwaysOpen?: boolean;
    opensAt: string | null;
    closesAt?: string | null;
  }): ComputedSurveyState {
    if (!survey.isPublished) {
      return "closed";
    }

    if (survey.isAlwaysOpen) {
      return "open";
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
    if (dto.isPublished) {
      throw new BadRequestException("survey_publish_requires_saved_definition");
    }
    const survey = await this.surveysRepo.insert(creatorId, dto);
    const computedState = this.computeState(survey);
    return { ...survey, computedState, responseCount: 0 };
  }

  async update(id: string, dto: UpdateSurveyDto): Promise<SurveyRecordWithState> {
    return this.mutationPolicy.withSurveyLock(id, async (tx) => {
      const current = await this.surveysRepo.findById(id, tx);
      if (!current) throw new NotFoundException("survey_not_found");
      await this.mutationPolicy.assertMeaningMutable(tx, id, current, dto);

      const isAlwaysOpen = dto.isAlwaysOpen ?? current.isAlwaysOpen;
      const opensAt = isAlwaysOpen ? null : dto.openAt === undefined ? current.opensAt : dto.openAt;
      const closesAt = isAlwaysOpen ? null : dto.closeAt === undefined ? current.closesAt : dto.closeAt;
      if (opensAt && closesAt && isoToMs(opensAt) >= isoToMs(closesAt)) {
        throw new BadRequestException("survey_invalid_schedule");
      }

      if (dto.isPublished === true) {
        const sections = await this.sectionsRepo.findBySurveyId(id, tx);
        const withQuestions = await Promise.all(sections.map(async (section) => ({
          ...section,
          questions: await this.questionsRepo.findBySectionId(section.id, tx),
        })));
        assertPublishableSurveyDefinition(
          {
            isKoreanOnly: dto.isKoreanOnly ?? current.isKoreanOnly,
            titleEn: dto.titleEn === undefined ? current.titleEn : dto.titleEn ?? null,
          },
          withQuestions,
        );
      }

      const survey = await this.surveysRepo.update(id, dto, tx);
      if (!survey) throw new NotFoundException("survey_not_found");
      const computedState = this.computeState(survey);
      return {
        ...survey,
        computedState,
        responseCount: current.responseCount ?? 0,
        derivedVersionCount: current.derivedVersionCount,
      };
    });
  }

  async delete(id: string): Promise<void> {
    await this.mutationPolicy.withHardDelete(id, (tx) =>
      this.surveysRepo.delete(id, tx),
    );
  }

  async duplicate(id: string, creatorId: string): Promise<SurveyRecordWithState> {
    return this.mutationPolicy.withSurveyLock(id, async (tx) => {
      // Duplication is a manager operation and reads the saved survey directly.
      const original = await this.surveysRepo.findById(id, tx);
      if (!original) throw new NotFoundException("survey_not_found");

      const sections = await this.sectionsRepo.findBySurveyId(id, tx);
      const sectionsWithQuestions = await Promise.all(
        sections.map(async (section) => ({
          ...section,
          questions: await this.questionsRepo.findBySectionId(section.id, tx),
        })),
      );

      const newSurvey = await this.surveysRepo.insert(
        creatorId,
        {
          kind: original.kind as CreateSurveyDto["kind"],
          titleKo: `${original.titleKo} (복사본)`,
          titleEn: original.titleEn ? `${original.titleEn} (Copy)` : undefined,
          descriptionKo: original.descriptionKo ?? undefined,
          descriptionEn: original.descriptionEn ?? undefined,
          feeRequirementPolicy: original.feePayersOnly ? "PAID_ONLY" : "NONE",
          allowMultipleResponses: original.allowMultipleResponses,
          allowResponseEdit: original.allowResponseEdit,
          isKoreanOnly: original.isKoreanOnly,
          isPublished: false,
          resultVisibility: "PRIVATE",
          maxResponseCount: original.maxResponses ?? undefined,
          openAt: original.opensAt ?? undefined,
          closeAt: original.closesAt ?? undefined,
          isAlwaysOpen: original.isAlwaysOpen,
        },
        tx,
        {
          previousVersionId: original.id,
          versionNumber: original.versionNumber + 1,
        },
      );

      const copiedSectionIdBySourceId = new Map<string, string>();
      const copiedSections = [] as Array<{
        source: (typeof sectionsWithQuestions)[number];
        copy: SurveySectionRecord;
      }>;

      for (const section of sectionsWithQuestions) {
        const newSection = await this.sectionsRepo.insert(
          newSurvey.id,
          {
            titleKo: section.titleKo,
            titleEn: section.titleEn ?? undefined,
            descriptionKo: section.descriptionKo ?? undefined,
            descriptionEn: section.descriptionEn ?? undefined,
            sortOrder: section.sortOrder,
          },
          tx,
        );

        copiedSectionIdBySourceId.set(section.id, newSection.id);
        copiedSections.push({ source: section, copy: newSection });
      }

      for (const { source, copy } of copiedSections) {
        for (const question of source.questions) {
          const sourceBranchMap = question.config?.goToSectionByValue;
          const copiedConfig = question.config
            ? {
                ...question.config,
                ...(sourceBranchMap
                  ? {
                      goToSectionByValue: Object.fromEntries(
                        Object.entries(sourceBranchMap).map(([value, target]) => [
                          value,
                          target === "SUBMIT"
                            ? target
                            : copiedSectionIdBySourceId.get(target) ?? target,
                        ]),
                      ),
                    }
                  : {}),
              }
            : undefined;

          await this.questionsRepo.insert(
            copy.id,
            {
              titleKo: question.titleKo,
              titleEn: question.titleEn ?? undefined,
              descriptionKo: question.descriptionKo ?? undefined,
              descriptionEn: question.descriptionEn ?? undefined,
              questionType: question.questionType,
              options: question.options ?? undefined,
              config: copiedConfig,
              answerRegex: question.answerRegex ?? undefined,
              isRequired: question.isRequired,
              sortOrder: question.sortOrder,
            },
            tx,
          );
        }
      }

      const computedState = this.computeState(newSurvey);
      return { ...newSurvey, computedState, responseCount: 0 };
    });
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
                rawAnswersHidden: false,
              };
            }

            if (q.questionType === "grid_single" || q.questionType === "grid_multiple") {
              const rows = q.config?.rows ?? [];
              const columns = q.config?.columns ?? [];
              const counts = new Map<string, number>();
              const rowAnswerCounts = new Map<string, number>();

              for (const answer of questionAnswers) {
                const grid = answer.content?.grid;
                if (!grid || typeof grid !== "object") continue;
                for (const [rowValue, selected] of Object.entries(grid as Record<string, unknown>)) {
                  const selectedValues = Array.isArray(selected) ? selected : [selected];
                  if (selectedValues.some((value) => typeof value === "string")) {
                    rowAnswerCounts.set(rowValue, (rowAnswerCounts.get(rowValue) ?? 0) + 1);
                  }
                  for (const columnValue of selectedValues) {
                    if (typeof columnValue !== "string") continue;
                    const key = `${rowValue}\u0000${columnValue}`;
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                  }
                }
              }

              return {
                questionId: q.id,
                questionType: q.questionType,
                titleKo: q.titleKo,
                titleEn: q.titleEn,
                totalAnswers,
                grid: {
                  rows,
                  columns,
                  cells: rows.flatMap((row) => columns.map((column) => {
                    const count = counts.get(`${row.value}\u0000${column.value}`) ?? 0;
                    return {
                      rowValue: row.value,
                      columnValue: column.value,
                      count,
                      percentage: (rowAnswerCounts.get(row.value) ?? 0) > 0
                        ? Math.round((count / (rowAnswerCounts.get(row.value) ?? 1)) * 1_000) / 10
                        : 0,
                    };
                  })),
                },
                rawAnswersHidden: false,
              };
            }

            // Free text and temporal values are intentionally never part of
            // the analytics DTO. Managers can review raw responses through
            // the permission-protected response endpoints instead.
            return {
              questionId: q.id,
              questionType: q.questionType,
              titleKo: q.titleKo,
              titleEn: q.titleEn,
              totalAnswers,
              rawAnswersHidden: true,
            };
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
      isAlwaysOpen: survey.isAlwaysOpen,
      opensAt: survey.opensAt,
      closesAt: survey.closesAt,
      titleKo: survey.titleKo,
      titleEn: survey.titleEn,
      totalResponses,
      questions: questionsAnalytics.flat(2),
    };
  }
}
