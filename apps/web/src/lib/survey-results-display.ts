import type { SurveyChoiceAnalyticsItem } from "@soc/contracts";

export function sortChoiceResults(
  choices: SurveyChoiceAnalyticsItem[],
): SurveyChoiceAnalyticsItem[] {
  return [...choices].sort((a, b) => b.count - a.count);
}
