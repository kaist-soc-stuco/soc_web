import type { QuestionType, QuestionOption } from "@soc/contracts";

export interface SurveyQuestionRecord {
  id: string;
  sectionId: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  questionType: QuestionType;
  options: QuestionOption[] | null;
  answerRegex: string | null;
  isRequired: boolean;
  editDeadlineAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
