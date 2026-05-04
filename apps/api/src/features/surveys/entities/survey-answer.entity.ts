export interface SurveyAnswerRecord {
  id: string;
  responseId: string;
  questionId: string;
  content: Record<string, unknown>;
  submittedAt: string;
  updatedAt: string;
}
