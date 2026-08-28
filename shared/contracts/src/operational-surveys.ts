export const OPERATIONAL_SURVEY_IDS = {
  cohortChatInvitation: "7a110000-0000-4000-8000-000000000001",
  promotionPostRequest: "7a110000-0000-4000-8000-000000000002",
  corporatePartnership: "7a110000-0000-4000-8000-000000000003",
} as const;

export const operationalSurveyPath = (
  surveyId: (typeof OPERATIONAL_SURVEY_IDS)[keyof typeof OPERATIONAL_SURVEY_IDS],
) => `/survey/${surveyId}`;
