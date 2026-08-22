import type { SurveyDetailResponse, SurveyQuestionRecord } from "@soc/contracts";

export const SUBMIT_BRANCH_TARGET = "SUBMIT";

function branchTargetForQuestion(
  question: SurveyQuestionRecord,
  answers: Record<string, import("./survey-answer-utils").AnswerValue>,
): string | null {
  if (question.questionType !== "single_choice" && question.questionType !== "dropdown") {
    return null;
  }
  const value = answers[question.id];
  return typeof value === "string"
    ? question.config?.goToSectionByValue?.[value] ?? null
    : null;
}

export function getVisibleSurveySectionIds(
  survey: SurveyDetailResponse,
  answers: Record<string, import("./survey-answer-utils").AnswerValue>,
): Set<string> {
  const sections = [...survey.sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const visible = new Set<string>();
  const visited = new Set<string>();
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  let current: SurveyDetailResponse["sections"][number] | undefined = sections[0];

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    visible.add(current.id);

    const branchQuestion = current.questions.find((question) =>
      branchTargetForQuestion(question, answers),
    );
    const target = branchQuestion
      ? branchTargetForQuestion(branchQuestion, answers)
      : null;

    if (!target) {
      const nextIndex = sections.findIndex((section) => section.id === current!.id) + 1;
      current = sections[nextIndex];
    } else if (target === SUBMIT_BRANCH_TARGET) {
      break;
    } else {
      current = sectionById.get(target);
    }
  }

  // A survey without branching keeps the familiar all-sections form. The
  // fallback also prevents an invalid legacy config from blanking the form.
  return visible.size > 0 ? visible : new Set(sections.map((section) => section.id));
}
