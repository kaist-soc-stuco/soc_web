export type ContentLocale = "ko" | "en";
export type FaqStatus = "DRAFT" | "PUBLISHED";

export interface LocalizedContent {
  value: string | null;
  translationUnavailable: boolean;
}

export interface PublicFaqItem {
  id: string;
  question: LocalizedContent;
  answer: LocalizedContent;
  displayOrder: number;
  updatedAt: string;
}

export interface PublicFaqTopic {
  id: string;
  title: LocalizedContent;
  displayOrder: number;
  items: PublicFaqItem[];
}

export interface PublicFaqListQuery {
  locale?: ContentLocale;
}

export interface PublicFaqListResponse {
  locale: ContentLocale;
  topics: PublicFaqTopic[];
}

export interface AdminFaqTopic {
  id: string;
  titleKr: string;
  titleEn: string;
  displayOrder: number;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFaq {
  id: string;
  topicId: string;
  questionKr: string;
  questionEn: string;
  answerKr: string;
  answerEn: string;
  displayOrder: number;
  status: FaqStatus;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFaqListResponse {
  topics: AdminFaqTopic[];
  items: AdminFaq[];
}

export interface CreateFaqTopicRequest {
  titleKr: string;
  titleEn: string;
  displayOrder: number;
}

export interface PatchFaqTopicRequest {
  titleKr?: string;
  titleEn?: string;
}

export interface ReorderFaqTopicRequest {
  displayOrder: number;
}

export interface CreateFaqRequest {
  topicId: string;
  questionKr: string;
  questionEn: string;
  answerKr: string;
  answerEn: string;
  displayOrder: number;
  status: FaqStatus;
}

export interface PatchFaqRequest {
  topicId?: string;
  questionKr?: string;
  questionEn?: string;
  answerKr?: string;
  answerEn?: string;
  displayOrder?: number;
  status?: FaqStatus;
}
