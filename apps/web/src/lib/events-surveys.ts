import type {
  ArticleListItem,
  ComputedSurveyState,
  PublicCalendarEventItem,
  SurveyRecord,
} from "@soc/contracts";
import { isoToDate, isoToMs, localDate, nowDate, nowMs } from "@soc/shared";

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
  visibilityScope?: ArticleListItem["visibilityScope"];
  isPinned?: boolean;
  pinOrder?: number | null;
  isAlwaysOpen?: boolean;
  imageUrl?: string | null;
  articleBoardCode?: string;
  likeCount?: number;
  scrapCount?: number;
  viewerHasLiked?: boolean;
  viewerHasScrapped?: boolean;
  allowLike?: boolean;
  linkedSurveyState?: ComputedSurveyState | null;
  linkedSurveyFeePayersOnly?: boolean;
  linkedSurveyMaxResponses?: number | null;
  linkedSurveyResponseCount?: number;
}

export interface CalendarEvent {
  id: string;
  calendarEventId?: string | null;
  sourceType?: PublicCalendarEventItem["sourceType"];
  category?: PublicCalendarEventItem["category"];
  kind: UnifiedItemKind;
  title: string;
  description: string;
  dateType: "open" | "close";
  rawDate: string;
  date: Date;
  computedState: ComputedSurveyState;
  articleId?: string | null;
  surveyId?: string | null;
  startAt?: Date;
  endAt?: Date;
  location?: string | null;
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

  if (start && end) return start === end ? start : `${start} ～ ${end}`;
  return start || end || "";
};

export const getCardPeriodText = (item: UnifiedItem, lang: "ko" | string = "ko") => {
  if (item.isAlwaysOpen || (!item.opensAt && !item.closesAt)) {
    return lang === "ko" ? "상시" : "Always open";
  }

  return formatEventCardPeriod(item.opensAt, item.closesAt, lang);
};

function formatEventCardPeriod(
  startValue: string | null,
  endValue: string | null,
  lang: string,
) {
  const startDate = startValue ? isoToDate(startValue) : null;
  const endDate = endValue ? isoToDate(endValue) : startDate;
  const referenceDate = nowDate();
  if (!startDate || Number.isNaN(startDate.getTime())) return "";
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return formatEventCardDate(startDate, lang, referenceDate);
  }

  const startText = formatEventCardDate(startDate, lang, referenceDate);
  const endText = formatEventCardDate(endDate, lang, referenceDate);
  const sameDay = isSameLocalDay(startDate, endDate);

  if (isAllDayRange(startDate, endDate)) {
    return sameDay
      ? `${startText} ${lang === "ko" ? "종일" : "All day"}`
      : `${startText} ～ ${endText} ${lang === "ko" ? "종일" : "All day"}`;
  }

  const startTime = formatEventCardTime(startDate, lang);
  const endTime = formatEventCardTime(endDate, lang);
  if (sameDay) {
    return startTime === endTime
      ? `${startText} ${startTime}`
      : `${startText} ${startTime} ～ ${endTime}`;
  }

  return `${startText} ${startTime} ～ ${endText} ${endTime}`;
}

function formatEventCardDate(date: Date, lang: string, referenceDate: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const yearPrefix =
    date.getFullYear() === referenceDate.getFullYear()
      ? ""
      : `${date.getFullYear()}.`;
  const weekday = new Intl.DateTimeFormat(
    lang === "ko" ? "ko-KR" : "en-US",
    { weekday: "short" },
  ).format(date);

  return lang === "ko"
    ? `${yearPrefix}${month}.${day} (${weekday})`
    : `${yearPrefix}${month}/${day} (${weekday})`;
}

function formatEventCardTime(date: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isAllDayRange(startDate: Date, endDate: Date) {
  const startsAtDayBoundary =
    startDate.getHours() === 0 &&
    startDate.getMinutes() === 0 &&
    startDate.getSeconds() === 0 &&
    startDate.getMilliseconds() === 0;
  const endsAtDayBoundary =
    endDate.getHours() === 0 &&
    endDate.getMinutes() === 0 &&
    endDate.getSeconds() === 0 &&
    endDate.getMilliseconds() === 0;
  const endsAtDayClose =
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59 &&
    endDate.getSeconds() === 59;

  return startsAtDayBoundary && (endsAtDayBoundary || endsAtDayClose);
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

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
    visibilityScope: undefined,
    isPinned: false,
    pinOrder: null,
    isAlwaysOpen: survey.isAlwaysOpen,
  }));

  const mappedEvents: UnifiedItem[] = events.map((event) => {
    const linkedSurvey =
      event.survey ??
      (event.surveyId
        ? surveys.find((survey) => survey.id === event.surveyId)
        : undefined);

    return {
      id: event.articleId,
      kind: "EVENT",
      titleKo: event.titleKo,
      titleEn: event.titleEn ?? null,
      descriptionKo: event.eventDescriptionKo ?? null,
      descriptionEn: event.eventDescriptionEn ?? null,
      computedState: getEventArticleState(event, currentMs),
      opensAt: event.eventStartDate ?? null,
      closesAt: event.eventEndDate ?? null,
      surveyId: event.surveyId ?? event.survey?.surveyId ?? null,
      linkedSurveyState:
        (linkedSurvey?.computedState as ComputedSurveyState | undefined) ?? null,
      linkedSurveyFeePayersOnly:
        event.survey
          ? event.survey.feeRequirementPolicy === "PAID_ONLY"
          : linkedSurvey && "feePayersOnly" in linkedSurvey
            ? linkedSurvey.feePayersOnly
            : false,
      linkedSurveyMaxResponses:
        event.survey?.maxResponses ?? linkedSurvey?.maxResponses ?? null,
      linkedSurveyResponseCount:
        event.survey?.responseCount ?? linkedSurvey?.responseCount ?? 0,
      feePayersOnly: false,
      // Article visibility controls who may read an event; it is not a language flag.
      isKoreanOnly:
        !event.titleEn?.trim() || !event.eventDescriptionEn?.trim(),
      resultVisibility: "PRIVATE",
      maxResponses: null,
      responseCount: 0,
      visibilityScope: event.visibilityScope,
      isPinned: event.isPinned,
      pinOrder: event.pinOrder ?? null,
      isAlwaysOpen: !event.eventStartDate && !event.eventEndDate,
      imageUrl: event.imageUrl ?? null,
      articleBoardCode: event.boardCode ?? "_EVENT",
      likeCount: event.likeCount,
      scrapCount: event.scrapCount,
      viewerHasLiked: event.viewerHasLiked,
      viewerHasScrapped: event.viewerHasScrapped,
      allowLike: true,
    };
  });

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
      const stateOrder = { open: 0, before_open: 1, closed: 2 };
      if (a.computedState !== b.computedState) {
        return stateOrder[a.computedState] - stateOrder[b.computedState];
      }

      const aAreEvents = a.kind === "EVENT" && b.kind === "EVENT";
      if (aAreEvents) {
        if (a.computedState === "before_open") {
          return getItemStartTime(a) - getItemStartTime(b);
        }
        if (a.computedState === "closed") {
          return getItemDeadlineTime(b) - getItemDeadlineTime(a);
        }

        return getItemDeadlineTime(a) - getItemDeadlineTime(b);
      }

      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      if (a.isPinned && b.isPinned) {
        const aPinOrder = a.pinOrder ?? Number.MAX_SAFE_INTEGER;
        const bPinOrder = b.pinOrder ?? Number.MAX_SAFE_INTEGER;
        if (aPinOrder !== bPinOrder) return aPinOrder - bPinOrder;
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

    if (item.kind === "EVENT" && (item.opensAt || item.closesAt)) {
      const startValue = item.opensAt ?? item.closesAt;
      const endValue = item.closesAt ?? item.opensAt;
      if (startValue && endValue) {
        parsed.push({
          id: item.id,
          sourceType: "ARTICLE",
          kind: item.kind,
          title,
          description,
          dateType: "open",
          rawDate: startValue,
          date: isoToDate(startValue),
          startAt: isoToDate(startValue),
          endAt: isoToDate(endValue),
          computedState: item.computedState,
          articleId: item.id,
          surveyId: item.surveyId,
        });
      }
      return;
    }

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
        startAt: isoToDate(item.opensAt),
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
        startAt: isoToDate(item.closesAt),
        endAt: isoToDate(item.closesAt),
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
    const startAt = isoToDate(item.startAt ?? item.date);
    const endAt = isoToDate(item.endAt ?? item.date);
    const isRange = Boolean(item.startAt && item.endAt && item.startAt !== item.endAt);
    const prefix = isRange
      ? ""
      : item.dateType === "open"
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
      calendarEventId: item.calendarEventId,
      sourceType: item.sourceType,
      category: item.category,
      articleId: item.articleId,
      surveyId: item.surveyId,
      kind: item.kind as UnifiedItemKind,
      title: `${prefix} ${title}`,
      description: "",
      dateType: item.dateType,
      rawDate: item.date,
      date: isoToDate(item.date),
      computedState,
      startAt,
      endAt,
      location: item.location,
    };
  });

export const isCalendarEventOnDay = (event: CalendarEvent, day: Date): boolean => {
  const start = event.startAt ?? event.date;
  const end = event.endAt ?? event.date;
  const dayStart = localDate(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = localDate(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() - 1;
  return start.getTime() <= dayEnd && end.getTime() >= dayStart;
};
