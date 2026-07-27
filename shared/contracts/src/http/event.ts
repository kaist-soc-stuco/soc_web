import type { ContentLocale, LocalizedContent } from "./faq";

export type EventVisibility = "PUBLIC" | "AUTHENTICATED" | "COMMITTEE";

export interface EventListQuery {
  fromMs: number;
  toMs: number;
  locale?: ContentLocale;
}

export interface EventItem {
  id: string;
  title: LocalizedContent;
  description: LocalizedContent;
  startAtMs: number;
  endAtMs: number;
  allDay: boolean;
  allDayStartDate: string | null;
  allDayEndDate: string | null;
  location: string;
  visibility: EventVisibility;
  updatedAt: string;
}

export interface EventListResponse {
  locale: ContentLocale;
  items: EventItem[];
}

export interface AdminEvent {
  id: string;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  startAtMs: number;
  endAtMs: number;
  allDay: boolean;
  allDayStartDate: string | null;
  allDayEndDate: string | null;
  location: string;
  visibility: EventVisibility;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  startAtMs: number;
  endAtMs: number;
  allDay: boolean;
  allDayStartDate?: string | null;
  allDayEndDate?: string | null;
  location: string;
  visibility: EventVisibility;
}

export type PatchEventRequest = Partial<CreateEventRequest>;
