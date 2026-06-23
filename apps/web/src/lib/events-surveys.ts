import type {
  ArticleListItem,
  ComputedSurveyState,
  PublicCalendarEventItem,
  SurveyRecord,
} from "@soc/contracts";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";

export type EventsSurveysTab = "event" | "survey" | "calendar";
export type EventsSurveysSortKey = "latest" | "deadline";
export type EventsSurveysStateFilter =
  | "all"
  | ComputedSurveyState;
export type UnifiedItemKind = SurveyRecord["kind"] | "EVENT";

export type SurveyRecordWithState = SurveyRecord & {
  computedState: ComputedSurveyState;
};

export interface UnifiedItem {
  id: string;
  kind: UnifiedItemKind;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  computedState: ComputedSurveyState;
  opensAt: string | null;
  closesAt: string | null;
  surveyId?: string | null;
  feePayersOnly?: boolean;
  isKoreanOnly?: boolean;
  resultVisibility?: string;
  maxResponses?: number | null;
  responseCount?: number;
  isAlwaysOpen?: boolean;
  imageUrl?: string | null;
}

export interface CalendarEvent {
  id: string;
  sourceType?: PublicCalendarEventItem["sourceType"];
  kind: UnifiedItemKind;
  title: string;
  description: string;
  dateType: "open" | "close";
  rawDate: string;
  date: Date;
  computedState: ComputedSurveyState;
  articleId?: string | null;
  surveyId?: string | null;
}

export const stripCalendarPrefix = (title: string) =>
  title
    .replace(/^\[시작\]\s*/, "")
    .replace(/^\[마감\]\s*/, "")
    .replace(/^\[Start\]\s*/, "")
    .replace(/^\[Deadline\]\s*/, "");

export const getEventArticleState = (
  event: ArticleListItem,
  currentMs = nowMs(),
): ComputedSurveyState => {
  if (!event.eventStartDate && !event.eventEndDate) return "open";
  if (!event.eventStartDate || !event.eventEndDate) return "open";

  const start = isoToMs(event.eventStartDate);
  const end = isoToMs(event.eventEndDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return "closed";
  if (currentMs < start) return "before_open";
  if (currentMs > end) return "closed";
  return "open";
};

export const getItemStartTime = (item: UnifiedItem) => {
  const raw = item.opensAt ?? item.closesAt;
  if (!raw) return 0;
  const time = isoToMs(raw);
  return Number.isNaN(time) ? 0 : time;
};

export const getItemDeadlineTime = (item: UnifiedItem) => {
  const raw = item.closesAt ?? item.opensAt;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const time = isoToMs(raw);
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

export const isClosedItem = (item: UnifiedItem) =>
  item.computedState === "closed";

export const isOpenItem = (item: UnifiedItem) =>
  item.computedState === "open";

export const formatCompactDateTime = (value: string | null) => {
  if (!value) return "";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
};

export const formatCardDate = (value: string | null) => {
  if (!value) return "";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${month}.${day}`;
};

export const getPeriodText = (item: UnifiedItem) => {
  const start = formatCompactDateTime(item.opensAt);
  const end = formatCompactDateTime(item.closesAt);

  if (start && end) return `${start} ~ ${end}`;
  return start || end || "";
};

export const getCardPeriodText = (item: UnifiedItem, lang: "ko" | string = "ko") => {
  if (item.isAlwaysOpen || (!item.opensAt && !item.closesAt)) {
    return lang === "ko" ? "상시" : "Always open";
  }

  const start = formatCardDate(item.opensAt);
  const end = formatCardDate(item.closesAt);

  if (start && end) return `${start} ~ ${end}`;
  return start || end || "";
};

export const buildUnifiedItems = (
  surveys: SurveyRecordWithState[],
  events: Array<ArticleListItem & { imageUrl?: string | null }>,
  currentMs = nowMs(),
): UnifiedItem[] => {
  const mappedSurveys: UnifiedItem[] = surveys
    .filter((survey) => !(survey.kind === "EVENT" && survey.connectedPostId))
    .map((survey) => ({
    id: survey.id,
    kind: survey.kind,
    titleKo: survey.titleKo,
    titleEn: survey.titleEn,
    descriptionKo: survey.descriptionKo,
    descriptionEn: survey.descriptionEn,
    computedState: survey.computedState,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
    feePayersOnly: survey.feePayersOnly,
    isKoreanOnly: survey.isKoreanOnly,
    resultVisibility: survey.resultVisibility,
    maxResponses: survey.maxResponses,
    responseCount: survey.responseCount,
    isAlwaysOpen: survey.isAlwaysOpen,
  }));

  const mappedEvents: UnifiedItem[] = events.map((event) => ({
    id: event.articleId,
    kind: "EVENT",
    titleKo: event.titleKo,
    titleEn: event.titleEn ?? null,
    descriptionKo: event.eventDescription ?? null,
    descriptionEn: event.eventDescription ?? null,
    computedState: getEventArticleState(event, currentMs),
    opensAt: event.eventStartDate ?? null,
    closesAt: event.eventEndDate ?? null,
    surveyId: event.surveyId,
    feePayersOnly: false,
    isKoreanOnly: event.visibilityScope === "MEMBERS",
    resultVisibility: "PRIVATE",
    maxResponses: null,
    responseCount: 0,
    isAlwaysOpen: !event.eventStartDate && !event.eventEndDate,
    imageUrl: event.imageUrl ?? null,
  }));

  return [...mappedSurveys, ...mappedEvents];
};

export const filterItemsByTab = (
  items: UnifiedItem[],
  tab: string,
) =>
  items.filter((item) => {
    if (tab === "survey") {
      return item.kind === "SURVEY" || item.kind === "VOTE";
    }
    return item.kind === "EVENT";
  });

export const sortVisibleItems = (
  items: UnifiedItem[],
  sortBy: EventsSurveysSortKey,
  stateFilter: EventsSurveysStateFilter | boolean,
) =>
  [...items]
    .filter((item) =>
      typeof stateFilter === "boolean"
        ? stateFilter
          ? isOpenItem(item)
          : true
        : stateFilter === "all"
          ? true
          : item.computedState === stateFilter,
    )
    .sort((a, b) => {
      const stateOrder = { before_open: 0, open: 1, closed: 2 };
      if (a.computedState !== b.computedState) {
        return stateOrder[a.computedState] - stateOrder[b.computedState];
      }
      if (sortBy === "deadline") {
        return getItemDeadlineTime(a) - getItemDeadlineTime(b);
      }
      return getItemStartTime(b) - getItemStartTime(a);
    });

export const buildCalendarEvents = (
  items: UnifiedItem[],
  lang: "ko" | string,
): CalendarEvent[] => {
  const parsed: CalendarEvent[] = [];

  items.forEach((item) => {
    const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
    const description =
      lang === "ko"
        ? item.descriptionKo || ""
        : item.descriptionEn || item.descriptionKo || "";

    if (item.opensAt) {
      parsed.push({
        id: item.id,
        sourceType: item.kind === "EVENT" ? "ARTICLE" : "SURVEY",
        kind: item.kind,
        title: `${lang === "ko" ? "[시작]" : "[Start]"} ${title}`,
        description,
        dateType: "open",
        rawDate: item.opensAt,
        date: isoToDate(item.opensAt),
        computedState: item.computedState,
        articleId: item.kind === "EVENT" ? item.id : null,
        surveyId: item.surveyId,
      });
    }

    if (item.closesAt) {
      parsed.push({
        id: item.id,
        sourceType: item.kind === "EVENT" ? "ARTICLE" : "SURVEY",
        kind: item.kind,
        title: `${lang === "ko" ? "[마감]" : "[Deadline]"} ${title}`,
        description,
        dateType: "close",
        rawDate: item.closesAt,
        date: isoToDate(item.closesAt),
        computedState: item.computedState,
        articleId: item.kind === "EVENT" ? item.id : null,
        surveyId: item.surveyId,
      });
    }
  });

  return parsed;
};

export const buildCalendarEventsFromPublicItems = (
  items: PublicCalendarEventItem[],
  lang: "ko" | string,
  currentMs = nowMs(),
): CalendarEvent[] =>
  items.map((item) => {
    const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
    const prefix =
      item.dateType === "open"
        ? lang === "ko"
          ? "[시작]"
          : "[Start]"
        : lang === "ko"
          ? "[마감]"
          : "[Deadline]";
    const time = isoToMs(item.date);
    const computedState: ComputedSurveyState =
      item.dateType === "open"
        ? currentMs < time
          ? "before_open"
          : "open"
        : currentMs > time
          ? "closed"
          : "open";

    return {
      id: item.id,
      sourceType: item.sourceType,
      articleId: item.articleId,
      surveyId: item.surveyId,
      kind: item.kind as UnifiedItemKind,
      title: `${prefix} ${title}`,
      description: "",
      dateType: item.dateType,
      rawDate: item.date,
      date: isoToDate(item.date),
      computedState,
    };
  });
