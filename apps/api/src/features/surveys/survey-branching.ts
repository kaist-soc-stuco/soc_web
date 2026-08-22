import { BadRequestException } from "@nestjs/common";
import type {
  SurveyQuestionConfig,
  SurveyQuestionRecord,
} from "@soc/contracts";

export const SUBMIT_BRANCH_TARGET = "SUBMIT" as const;

export interface SurveySectionWithQuestions {
  id: string;
  sortOrder: number;
  questions: SurveyQuestionRecord[];
}

function isBranchableQuestion(question: SurveyQuestionRecord): boolean {
  return question.questionType === "single_choice" || question.questionType === "dropdown";
}

function getBranchMap(question: SurveyQuestionRecord): Record<string, string> {
  const branchMap = question.config?.goToSectionByValue;
  return branchMap && typeof branchMap === "object" ? branchMap : {};
}

export function assertQuestionBranchConfiguration(
  question: SurveyQuestionRecord,
  sectionIds: ReadonlySet<string>,
  currentSectionId?: string,
): void {
  const branchMap = getBranchMap(question);
  if (Object.keys(branchMap).length === 0) return;

  if (!isBranchableQuestion(question)) {
    throw new BadRequestException("survey_branch_requires_choice_question");
  }

  const optionValues = new Set((question.options ?? []).map((option) => option.value));
  for (const [optionValue, target] of Object.entries(branchMap)) {
    if (!optionValues.has(optionValue)) {
      throw new BadRequestException("survey_branch_option_not_found");
    }
    if (target !== SUBMIT_BRANCH_TARGET && !sectionIds.has(target)) {
      throw new BadRequestException("survey_branch_section_not_found");
    }
    if (target === currentSectionId) {
      throw new BadRequestException("survey_branch_self_reference");
    }
  }
}

function selectedBranchTarget(
  question: SurveyQuestionRecord,
  answers: Map<string, Record<string, unknown>>,
): string | null {
  if (!isBranchableQuestion(question)) return null;
  const answer = answers.get(question.id);
  const value = answer?.value;
  if (typeof value !== "string") return null;
  return getBranchMap(question)[value] ?? null;
}

/**
 * Returns only sections/questions reachable from the first section for the
 * submitted answers. A malformed branch is rejected server-side so a client
 * cannot submit a question from a different path or create an infinite loop.
 */
export function getReachableSurveyQuestions(
  sections: SurveySectionWithQuestions[],
  answerInputs: Array<{ questionId: string; content: Record<string, unknown> }>,
): SurveyQuestionRecord[] {
  const orderedSections = [...sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  if (orderedSections.length === 0) return [];

  const sectionIds = new Set(orderedSections.map((section) => section.id));
  const answerByQuestionId = new Map(
    answerInputs.map((answer) => [answer.questionId, answer.content]),
  );
  const sectionById = new Map(orderedSections.map((section) => [section.id, section]));
  const reachable: SurveyQuestionRecord[] = [];
  const visitedSections = new Set<string>();
  let current: SurveySectionWithQuestions | undefined = orderedSections[0];

  while (current) {
    if (visitedSections.has(current.id)) {
      throw new BadRequestException("survey_branch_cycle");
    }
    visitedSections.add(current.id);

    const questions = [...current.questions].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    );
    for (const question of questions) {
      assertQuestionBranchConfiguration(question, sectionIds, current.id);
      reachable.push(question);
    }

    const branchQuestion = questions.find((question) =>
      selectedBranchTarget(question, answerByQuestionId),
    );
    const target = branchQuestion
      ? selectedBranchTarget(branchQuestion, answerByQuestionId)
      : null;

    if (!target) {
      const nextIndex = orderedSections.findIndex((section) => section.id === current!.id) + 1;
      current = orderedSections[nextIndex];
      continue;
    }

    if (target === SUBMIT_BRANCH_TARGET) break;
    current = sectionById.get(target);
    if (!current) {
      throw new BadRequestException("survey_branch_section_not_found");
    }
  }

  return reachable;
}

export function withBranchConfig(
  config: SurveyQuestionConfig | null | undefined,
  mapping: Record<string, string>,
): SurveyQuestionConfig {
  const next: SurveyQuestionConfig = { ...(config ?? {}) };
  if (Object.keys(mapping).length > 0) {
    next.goToSectionByValue = mapping;
  } else {
    delete next.goToSectionByValue;
  }
  return next;
}
