import type { QuestionType, SurveyChoiceAnalyticsItem } from "@soc/contracts";

export const SHORT_TEXT_INITIAL_LIMIT = 10;

export interface VisibleTextResponses {
  hiddenCount: number;
  visibleTexts: string[];
}

export function getVisibleTextResponses(
  texts: string[],
  questionType: QuestionType,
  expanded: boolean,
  initialLimit = SHORT_TEXT_INITIAL_LIMIT,
): VisibleTextResponses {
  if (questionType !== "short_text" || expanded) {
    return { hiddenCount: 0, visibleTexts: texts };
  }

  const visibleTexts = texts.slice(0, initialLimit);
  return {
    hiddenCount: Math.max(texts.length - visibleTexts.length, 0),
    visibleTexts,
  };
}

export function sortChoiceResults(
  choices: SurveyChoiceAnalyticsItem[],
): SurveyChoiceAnalyticsItem[] {
  return [...choices].sort((a, b) => b.count - a.count);
}
