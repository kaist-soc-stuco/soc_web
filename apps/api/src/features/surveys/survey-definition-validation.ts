import { BadRequestException } from "@nestjs/common";

import type { SurveyQuestionRecord, SurveySectionRecord } from "@soc/contracts";

import { assertQuestionBranchConfiguration } from "./survey-branching";

type SectionWithQuestions = SurveySectionRecord & { questions: SurveyQuestionRecord[] };

const CHOICE_TYPES = new Set(["single_choice", "multiple_choice", "dropdown"]);
const GRID_TYPES = new Set(["grid_single", "grid_multiple"]);

export function assertSurveyQuestionDefinition(question: SurveyQuestionRecord): void {
  if (question.questionType === "file_upload") {
    const maxFiles = question.config?.maxFiles ?? 1;
    const maxSizeBytes = question.config?.maxSizeBytes ?? 10_000_000;
    if (maxFiles < 1 || maxFiles > 10) {
      throw new BadRequestException("survey_file_upload_count_invalid");
    }
    if (maxSizeBytes < 1 || maxSizeBytes > 20_000_000) {
      throw new BadRequestException("survey_file_upload_size_invalid");
    }
  }
  if (question.questionType === "rating") {
    const ratingMax = question.config?.ratingMax ?? 5;
    if (!Number.isInteger(ratingMax) || ratingMax < 2 || ratingMax > 10) {
      throw new BadRequestException("survey_rating_scale_invalid");
    }
  }
  if (CHOICE_TYPES.has(question.questionType) && (question.options?.length ?? 0) < 1) {
    throw new BadRequestException("survey_choice_requires_option");
  }
  if (GRID_TYPES.has(question.questionType)) {
    if ((question.config?.rows?.length ?? 0) < 1) {
      throw new BadRequestException("survey_grid_requires_rows");
    }
    if ((question.config?.columns?.length ?? 0) < 1) {
      throw new BadRequestException("survey_grid_requires_columns");
    }
  }
  if (question.answerRegex) {
    try {
      new RegExp(question.answerRegex);
    } catch {
      throw new BadRequestException("answer_regex_invalid");
    }
  }
}

export function assertSurveyBranchDefinitions(sections: SectionWithQuestions[]): void {
  const ordered = [...sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const sectionIds = new Set(ordered.map((section) => section.id));

  ordered.forEach((section, index) => {
    const forwardIds = new Set(ordered.slice(index + 1).map((item) => item.id));
    const branchingQuestions = section.questions.filter(
      (question) => Object.keys(question.config?.goToSectionByValue ?? {}).length > 0,
    );
    if (branchingQuestions.length > 1) {
      throw new BadRequestException("survey_section_allows_one_branch_question");
    }
    for (const question of section.questions) {
      assertQuestionBranchConfiguration(question, sectionIds, section.id, forwardIds);
    }
  });
}

export function assertPublishableSurveyDefinition(
  survey: { isKoreanOnly: boolean; titleEn: string | null },
  sections: SectionWithQuestions[],
): void {
  if (sections.length === 0) {
    throw new BadRequestException("survey_requires_section");
  }
  if (sections.every((section) => section.questions.length === 0)) {
    throw new BadRequestException("survey_requires_question");
  }
  if (!survey.isKoreanOnly) {
    if (!survey.titleEn?.trim()) {
      throw new BadRequestException("survey_english_title_required");
    }
    for (const section of sections) {
      if (!section.titleEn?.trim()) {
        throw new BadRequestException("survey_section_english_title_required");
      }
      for (const question of section.questions) {
        if (!question.titleEn?.trim()) {
          throw new BadRequestException("survey_question_english_title_required");
        }
      }
    }
  }
  for (const section of sections) {
    for (const question of section.questions) {
      assertSurveyQuestionDefinition(question);
    }
  }
  assertSurveyBranchDefinitions(sections);
}
