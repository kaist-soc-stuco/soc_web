import type {
  ArticleListItem,
  ComputedSurveyState,
  PublicCalendarEventItem,
  PublicSurveyRecord,
  SurveyParticipationEligibility,
} from "@soc/contracts";
import { isoToDate, isoToMs, localDate, msToTimeObj, nowDate, nowMs } from "@soc/shared";

const EVENT_TIME_ZONE = "Asia/Seoul";

export type EventsSurveysTab = "event" | "survey" | "calendar";
export type EventsSurveysSortKey = "latest" | "deadline";
export type EventsSurveysStateFilter =
  | "all"
  | "active"
  | "always"
  | ComputedSurveyState;
export type UnifiedItemKind = PublicSurveyRecord["kind"] | "EVENT";

export type SurveyRecordWithState = PublicSurveyRecord;

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
  allowAnonymous?: boolean;
  isKoreanOnly?: boolean;
  resultVisibility?: string;
  maxResponses?: number | null;
  responseCount?: number;
  participationEligibility?: SurveyParticipationEligibility;
  visibilityScope?: ArticleListItem["visibilityScope"];
  isPinned?: boolean;
  pinOrder?: number | null;
  isAlwaysOpen?: boolean;
  imageUrl?: string | null;
  location?: string | null;
  locationEn?: string | null;
  articleBoardCode?: string;
  likeCount?: number;
  scrapCount?: number;
  viewerHasLiked?: boolean;
  viewerHasScrapped?: boolean;
  allowLike?: boolean;
  linkedSurveyState?: ComputedSurveyState | null;
  linkedSurveyClosesAt?: string | null;
  linkedSurveyAlwaysOpen?: boolean;
  linkedSurveyFeePayersOnly?: boolean;
  linkedSurveyMaxResponses?: number | null;
  linkedSurveyResponseCount?: number;
}

export interface CalendarEvent {
  voteId?: string | null;
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
  isAllDay?: boolean;
  isAlways?: boolean;
  location?: string | null;
  locationEn?: string | null;
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
  const ms = isoToMs(value);
  if (Number.isNaN(ms)) return "";
  const date = msToTimeObj(ms, EVENT_TIME_ZONE);
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  const hour = String(date.hour).padStart(2, "0");
  const minute = String(date.minute).padStart(2, "0");

  return `${date.year}.${month}.${day} ${hour}:${minute}`;
};

export const formatCardDate = (value: string | null) => {
  if (!value) return "";
  const ms = isoToMs(value);
  if (Number.isNaN(ms)) return "";
  const date = msToTimeObj(ms, EVENT_TIME_ZONE);
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

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

export function getDiscoveryPeriod(item: UnifiedItem, lang: string) {
  if (item.isAlwaysOpen) return lang === "ko" ? "상시" : "Always open";
  const labelDate = (value: string) => {
    const date = isoToDate(value);
    const parts = msToTimeObj(date.getTime(), EVENT_TIME_ZONE);
    const current = msToTimeObj(nowMs(), EVENT_TIME_ZONE);
    const year = parts.year === current.year ? "" : `${parts.year}${lang === "ko" ? "년 " : " "}`;
    if (lang !== "ko") return year + new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, month: "short", day: "numeric", weekday: "short" }).format(date);
    const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: EVENT_TIME_ZONE, weekday: "short" }).format(date);
    return `${year}${parts.month}월 ${parts.day}일 (${weekday})`;
  };
  if (!item.opensAt) return item.closesAt ? `${labelDate(item.closesAt)} ${lang === "ko" ? "마감" : "deadline"}` : lang === "ko" ? "일정 미정" : "Date to be announced";
  const start = isoToDate(item.opensAt);
  const end = item.closesAt ? isoToDate(item.closesAt) : null;
  if (end && !isSameLocalDay(start, end)) return `${labelDate(item.opensAt)} – ${labelDate(item.closesAt!)}`;
  return labelDate(item.opensAt);
}

export function getDiscoveryTime(item: UnifiedItem, lang: string, startOnly = false) {
  if (item.isAlwaysOpen) return "";
  const start = item.opensAt ? isoToDate(item.opensAt) : null;
  const end = item.closesAt ? isoToDate(item.closesAt) : null;
  if (start && end && isAllDayRange(start, end)) return lang === "ko" ? "종일" : "All day";
  const format = (date: Date) => {
    const { hour, minute } = msToTimeObj(date.getTime(), EVENT_TIME_ZONE);
    const time = `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
    return lang === "ko" ? `${hour < 12 ? "오전" : "오후"} ${time}` : `${time} ${hour < 12 ? "AM" : "PM"}`;
  };
  if (!start) return end ? `${format(end)} ${lang === "ko" ? "마감" : "deadline"}` : "";
  return !startOnly && end && format(start) !== format(end) ? `${format(start)} – ${format(end)}` : format(start);
}

export function getDiscoveryDateTime(item: UnifiedItem, lang: string) {
  const period = getDiscoveryPeriod(item, lang);
  const time = getDiscoveryTime(item, lang, true);
  if (!time) return period;
  if (time === "종일" || time === "All day") return `${period} · ${time}`;
  const start = { ...item, opensAt: item.opensAt ?? item.closesAt, closesAt: null };
  if (item.opensAt && item.closesAt && !isSameLocalDay(isoToDate(item.opensAt), isoToDate(item.closesAt))) {
    const end = { ...item, opensAt: item.closesAt, closesAt: null };
    return `${getDiscoveryPeriod(start, lang)} ${time} – ${getDiscoveryPeriod(end, lang)} ${getDiscoveryTime(end, lang)}`;
  }
  return `${getDiscoveryPeriod(start, lang)} ${time}`;
}

export function getDiscoveryBadge(item: UnifiedItem, lang: string, currentMs = nowMs()) {
  const ko = lang === "ko";
  const badge = (label: string, tone = "neutral", deadline?: string | null) => ({ label, tone, deadline: deadline ?? null });
  const kstDay = (ms: number) => Math.floor((ms + 9 * 3600000) / 86400000);
  const datedBadge = (label: string, target: string, tone = "neutral") => {
    const days = kstDay(isoToMs(target)) - kstDay(currentMs);
    const dDay = days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${-days}`;
    return badge(`${label} ${dDay}`, tone, target);
  };
  const event = item.kind === "EVENT";
  const full = event
    ? Boolean(item.linkedSurveyMaxResponses && (item.linkedSurveyResponseCount ?? 0) >= item.linkedSurveyMaxResponses)
    : Boolean(item.maxResponses && (item.responseCount ?? 0) >= item.maxResponses);
  if (full && (!event || item.computedState !== "closed")) return badge(ko ? "정원 마감" : "At capacity", "closed");
  if (item.computedState === "closed") {
    const end = item.closesAt;
    return end && !item.isAlwaysOpen && isoToMs(end) <= currentMs
      ? datedBadge(ko ? event ? "행사 종료" : "응답 마감" : event ? "Event ended" : "Response deadline", end, "closed")
      : badge(ko ? event ? "지난 행사" : "응답 중단" : event ? "Past event" : "Responses stopped", "closed");
  }
  const state = item.kind === "EVENT" ? item.linkedSurveyState : item.computedState;
  const deadline = item.kind === "EVENT" ? item.linkedSurveyClosesAt : item.closesAt;
  const alwaysOpen = item.kind === "EVENT" ? item.linkedSurveyAlwaysOpen : item.isAlwaysOpen;
  if (event && state === "closed") {
    return deadline && !alwaysOpen && isoToMs(deadline) <= currentMs
      ? datedBadge(ko ? "신청 마감" : "Registration deadline", deadline, "closed")
      : badge(ko ? "신청 중단" : "Registration stopped", "closed");
  }
  if (!event && state === "before_open" && item.opensAt) return datedBadge(ko ? "접수 시작" : "Opens", item.opensAt);
  if ((state === "open" || state === "before_open") && deadline && !alwaysOpen) {
    const end = isoToMs(deadline);
    if (event) {
      if (end <= currentMs) return badge(ko ? "신청 마감" : "Registration closed", "closed", deadline);
      if (kstDay(end) === kstDay(currentMs)) return badge(ko ? "오늘 마감" : "Closes today", "today", deadline);
      return datedBadge(ko ? "신청 마감" : "Registration deadline", deadline, "deadline");
    }
    return datedBadge(ko ? event ? "신청 마감" : "응답 마감" : event ? "Registration deadline" : "Response deadline", deadline,
      end <= currentMs ? "closed" : end - currentMs < 3 * 86400000 ? "urgent" : "open");
  }
  if (state === "open") return badge(ko ? alwaysOpen ? "상시 접수" : "접수 중" : alwaysOpen ? "Always open" : "Open", "open");
  if (event) return badge("");
  const target = item.computedState === "open" ? item.closesAt : item.opensAt;
  if (target) return datedBadge(ko ? item.computedState === "open" ? "행사 종료" : "행사" : item.computedState === "open" ? "Event ends" : "Event", target);
  return badge(ko ? "일정 미정" : "Date to be announced");
}

export function formatEventCardPeriod(
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
  const dateParts = msToTimeObj(date.getTime(), EVENT_TIME_ZONE);
  const referenceParts = msToTimeObj(referenceDate.getTime(), EVENT_TIME_ZONE);
  const month = String(dateParts.month).padStart(2, "0");
  const day = String(dateParts.day).padStart(2, "0");
  const yearPrefix =
    dateParts.year === referenceParts.year
      ? ""
      : `${dateParts.year}.`;
  const weekday = new Intl.DateTimeFormat(
    lang === "ko" ? "ko-KR" : "en-US",
    { timeZone: EVENT_TIME_ZONE, weekday: "short" },
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
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}

function isAllDayRange(startDate: Date, endDate: Date) {
  const start = msToTimeObj(startDate.getTime(), EVENT_TIME_ZONE);
  const end = msToTimeObj(endDate.getTime(), EVENT_TIME_ZONE);
  const startsAtDayBoundary =
    start.hour === 0 && start.minute === 0 && start.second === 0 && start.millisecond === 0;
  const endsAtDayBoundary =
    end.hour === 0 && end.minute === 0 && end.second === 0 && end.millisecond === 0;
  const endsAtDayClose =
    end.hour === 23 && end.minute === 59 && end.second === 59;

  return startsAtDayBoundary && (endsAtDayBoundary || endsAtDayClose);
}

function isSameLocalDay(first: Date, second: Date) {
  const firstParts = msToTimeObj(first.getTime(), EVENT_TIME_ZONE);
  const secondParts = msToTimeObj(second.getTime(), EVENT_TIME_ZONE);
  return (
    firstParts.year === secondParts.year &&
    firstParts.month === secondParts.month &&
    firstParts.day === secondParts.day
  );
}

export const buildUnifiedItems = (
  surveys: SurveyRecordWithState[],
  events: Array<ArticleListItem & { imageUrl?: string | null }>,
  currentMs = nowMs(),
): UnifiedItem[] => {
  const eventSurveyIds = new Set(
    events
      .map((event) => event.surveyId ?? event.survey?.surveyId ?? null)
      .filter((surveyId): surveyId is string => Boolean(surveyId)),
  );
  const mappedSurveys: UnifiedItem[] = surveys
    .filter((survey) => !eventSurveyIds.has(survey.id))
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
    allowAnonymous: survey.allowAnonymous,
    isKoreanOnly: survey.isKoreanOnly,
    resultVisibility: survey.resultVisibility,
    maxResponses: survey.maxResponses,
    responseCount: survey.responseCount,
    participationEligibility: survey.participationEligibility,
    visibilityScope: undefined,
    isPinned: false,
    pinOrder: null,
    isAlwaysOpen: survey.isAlwaysOpen,
    imageUrl: survey.descriptionImageUrlKo ?? survey.descriptionImageUrlEn ?? null,
    location: null,
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
      linkedSurveyClosesAt: event.survey?.closeAt ?? (linkedSurvey && "closesAt" in linkedSurvey ? linkedSurvey.closesAt : null) ?? null,
      linkedSurveyAlwaysOpen: linkedSurvey?.isAlwaysOpen ?? false,
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
      location: event.eventLocation?.trim() || null,
      locationEn: event.eventLocationEn?.trim() || null,
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
      return item.kind !== "EVENT";
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
          : stateFilter === "always"
            ? Boolean(item.isAlwaysOpen)
          : stateFilter === "active"
            ? item.computedState !== "closed"
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
          location: lang === "en" ? item.locationEn || item.location : item.location,
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
        location: lang === "en" ? item.locationEn || item.location : item.location,
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
        location: lang === "en" ? item.locationEn || item.location : item.location,
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
      voteId: item.voteId,
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
      isAllDay: item.isAllDay,
      isAlways: item.isAlways,
      location: lang === "en" ? item.locationEn || item.location : item.location,
    };
  });

export const isCalendarEventOnDay = (event: CalendarEvent, day: Date): boolean => {
  const start = event.startAt ?? event.date;
  const end = event.endAt ?? event.date;
  const dayStart = localDate(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = localDate(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() - 1;
  return start.getTime() <= dayEnd && end.getTime() >= dayStart;
};
