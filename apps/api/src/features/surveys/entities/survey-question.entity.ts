import type { QuestionType, QuestionOption, SurveyQuestionConfig } from "@soc/contracts";

export interface SurveyQuestionRecord {
  id: string;
  sectionId: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  questionType: QuestionType;
  options: QuestionOption[] | null;
  config: SurveyQuestionConfig | null;
  answerRegex: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
