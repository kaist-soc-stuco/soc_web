import { createApiClient } from "@soc/api-client";
import { isoToMs, localDate, msToDate, nowMs } from "@soc/shared";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getEventArticleState } from "@/lib/events-surveys";

interface EventCardRecord {
  id: string;
  imageUrl: string | null;
  palette: string;
  titleKo: string;
  titleEn?: string | null;
  descriptionKo?: string;
  descriptionEn?: string;
  isPinned: boolean;
  pinOrder: number | null;
  homeVisible: boolean;
  homeOrder: number | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  eventState: "before_open" | "open" | "closed";
  surveyId: string | null;
  linkedSurveyState: "before_open" | "open" | "closed" | null;
  linkedSurveyMaxResponses: number | null;
  linkedSurveyResponseCount: number;
}

interface EventCardItem {
  id: string;
  imageUrl: string | null;
  palette: string;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  eventState: "before_open" | "open" | "closed";
  surveyId: string | null;
  linkedSurveyState: "before_open" | "open" | "closed" | null;
  linkedSurveyMaxResponses: number | null;
  linkedSurveyResponseCount: number;
}

type EventSortRecord = Pick<EventCardRecord, "isPinned" | "pinOrder" | "homeOrder" | "startAt" | "endAt">;

const EVENT_PALETTES = [
  "home-event-palette-green",
  "home-event-palette-blue",
  "home-event-palette-clay",
  "home-event-palette-violet",
] as const;

function resolvePalette(id: string) {
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return EVENT_PALETTES[hash % EVENT_PALETTES.length];
}

function getEventSortGroup(event: EventSortRecord, referenceTime: number) {
  if (event.isPinned) return 0;
  const start = event.startAt ? Date.parse(event.startAt) : Number.NaN;
  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
  if ((!Number.isFinite(start) || start <= referenceTime) && (!Number.isFinite(end) || referenceTime <= end)) return 1;
  if (Number.isFinite(start) && referenceTime < start) return 2;
  return 3;
}

function compareEventCards(a: EventSortRecord, b: EventSortRecord, referenceTime: number) {
  const aHasHomeOrder = a.homeOrder !== null && Number.isFinite(a.homeOrder);
  const bHasHomeOrder = b.homeOrder !== null && Number.isFinite(b.homeOrder);
  if (aHasHomeOrder !== bHasHomeOrder) return aHasHomeOrder ? -1 : 1;
  if (aHasHomeOrder && bHasHomeOrder && a.homeOrder !== b.homeOrder) {
    return (a.homeOrder ?? Number.MAX_SAFE_INTEGER) - (b.homeOrder ?? Number.MAX_SAFE_INTEGER);
  }
  const aGroup = getEventSortGroup(a, referenceTime);
  const bGroup = getEventSortGroup(b, referenceTime);
  if (aGroup !== bGroup) return aGroup - bGroup;
  if (a.isPinned && b.isPinned) {
    const difference = (a.pinOrder ?? Number.MAX_SAFE_INTEGER) - (b.pinOrder ?? Number.MAX_SAFE_INTEGER);
    if (difference !== 0) return difference;
  }
  if (aGroup === 1) {
    return (Date.parse(a.endAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.endAt ?? "") || Number.MAX_SAFE_INTEGER);
  }
  return (Date.parse(a.startAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.startAt ?? "") || Number.MAX_SAFE_INTEGER);
}

function startsWithinNextMonth(startAt: string | null, referenceTime: number) {
  if (!startAt) return false;
  const start = isoToMs(startAt);
  if (!Number.isFinite(start) || start <= referenceTime) return false;
  const nextMonth = msToDate(referenceTime);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return start <= nextMonth.getTime();
}

function formatEventStatusDate(value: string | null) {
  if (!value) return null;
  const timestamp = isoToMs(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = msToDate(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatEventDateRange(startAt: string | null, endAt: string | null) {
  const start = formatEventStatusDate(startAt);
  const end = formatEventStatusDate(endAt);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}

function normalizeEventState(value: string | null | undefined): EventCardRecord["linkedSurveyState"] {
  return value === "before_open" || value === "open" || value === "closed"
    ? value
    : null;
}

function localizeEvent(record: EventCardRecord, lang: string): EventCardItem {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    palette: record.palette,
    title: lang === "ko" ? record.titleKo : record.titleEn || record.titleKo,
    description: lang === "ko"
      ? record.descriptionKo || record.titleKo
      : record.descriptionEn || record.titleEn || record.descriptionKo || record.titleKo,
    startAt: record.startAt,
    endAt: record.endAt,
    location: record.location,
    eventState: record.eventState,
    surveyId: record.surveyId,
    linkedSurveyState: record.linkedSurveyState,
    linkedSurveyMaxResponses: record.linkedSurveyMaxResponses,
    linkedSurveyResponseCount: record.linkedSurveyResponseCount,
  };
}

function EventFallback({ event }: { event: EventCardItem }) {
  const fallbackImages = [
    "/hero_background_1.jpg",
    "/hero_background4.jpeg",
    "/hero_background2.jpeg",
  ];
  const imageIndex = Array.from(event.id).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  ) % fallbackImages.length;

  return (
    <div className={`home-event-fallback ${event.palette}`} aria-hidden="true">
      <img
        src={fallbackImages[imageIndex]}
        alt=""
        draggable={false}
        className="home-event-fallback-image"
      />
      <span className="home-event-fallback-mark">KAIST SoC</span>
    </div>
  );
}

function EventImage({ event }: { event: EventCardItem }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [event.imageUrl]);
  if (!event.imageUrl || failed) return <EventFallback event={event} />;
  return (
    <img
      src={event.imageUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
    />
  );
}

const EVENT_DDAY_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function localDayTimestamp(value: number) {
  const date = msToDate(value);
  return localDate(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getEventDdayLabel(startAt: string | null, endAt: string | null) {
  const today = localDayTimestamp(nowMs());
  const start = startAt ? isoToMs(startAt) : Number.NaN;
  const end = endAt ? isoToMs(endAt) : Number.NaN;
  const startDay = Number.isFinite(start) ? localDayTimestamp(start) : null;
  const endDay = Number.isFinite(end) ? localDayTimestamp(end) : null;
  const targetDay = startDay !== null && startDay >= today
    ? startDay
    : endDay !== null && endDay >= today
      ? endDay
      : null;

  if (targetDay === null) return null;
  const dayDifference = Math.round((targetDay - today) / DAY_IN_MS);
  if (dayDifference < 0 || dayDifference > EVENT_DDAY_WINDOW_DAYS) return null;
  return dayDifference === 0 ? "D-Day" : `D-${dayDifference}`;
}

function EventDayBadge({ event }: { event: EventCardItem }) {
  const label = getEventDdayLabel(event.startAt, event.endAt);
  return label ? <span className="home-editorial-dday">{label}</span> : null;
}

function getEventApplicationLabel(event: EventCardItem, lang: string) {
  if (!event.surveyId || !event.linkedSurveyState) return null;

  const isFull = Boolean(
    event.linkedSurveyMaxResponses &&
      event.linkedSurveyMaxResponses > 0 &&
      event.linkedSurveyResponseCount >= event.linkedSurveyMaxResponses,
  );
  if (isFull || event.linkedSurveyState === "closed") {
    return lang === "ko" ? "신청 마감" : "Applications closed";
  }
  if (event.linkedSurveyState === "open") {
    return event.eventState === "before_open"
      ? lang === "ko" ? "사전 신청" : "Pre-registration"
      : lang === "ko" ? "신청중" : "Applications open";
  }
  return lang === "ko" ? "신청 예정" : "Registration opens soon";
}

function EventApplicationBadge({ event, lang }: { event: EventCardItem; lang: string }) {
  const label = getEventApplicationLabel(event, lang);
  return label ? <span className="home-editorial-event-application">{label}</span> : null;
}

function EventCard({
  event,
  enter,
  enterIndex,
  lang,
}: {
  event: EventCardItem;
  enter: boolean;
  enterIndex: number;
  lang: string;
}) {
  const dateRange = formatEventDateRange(event.startAt, event.endAt);
  const style = {
    "--home-event-card-delay": `${enterIndex * 80}ms`,
  } as CSSProperties;

  return (
    <Link
      to={`/events/${encodeURIComponent(event.id)}`}
      draggable={false}
      onDragStart={(dragEvent) => dragEvent.preventDefault()}
      className={`home-portal-event-card select-none group ${enter ? "home-event-card-enter" : ""}`}
      style={style}
    >
      <div className="home-portal-event-media">
        <EventImage event={event} />
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap gap-1.5">
          <EventDayBadge event={event} />
          <EventApplicationBadge event={event} lang={lang} />
        </div>
      </div>
      <div className="home-portal-event-body">
        {dateRange ? <time className="home-portal-event-date">{dateRange}</time> : null}
        <h3 className="line-clamp-2">{event.title}</h3>
        {event.description ? <p className="line-clamp-2">{event.description}</p> : null}
        {event.location ? (
          <div className="home-portal-event-location mt-auto flex min-w-0 items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function EventCarouselSkeleton() {
  return (
    <section className="home-events-section" aria-hidden="true">
      <div className="home-section-heading">
        <div className="home-loading-surface h-8 w-24 rounded" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="home-loading-surface aspect-[16/9]" />
            <div className="space-y-3 p-5">
              <div className="home-loading-surface h-3 w-20 rounded" />
              <div className="home-loading-surface h-5 w-4/5 rounded" />
              <div className="home-loading-surface h-3 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EventCarousel() {
  const { lang } = useLanguage();
  const [events, setEvents] = useState<EventCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragAxisRef = useRef<"x" | "y" | null>(null);
  const suppressClickRef = useRef(false);
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  useEffect(() => {
    let active = true;
    void apiClient.getArticles("_EVENT", { limit: 12 }).then((response) => {
      if (!active) return;
      const referenceTime = nowMs();
      const nextEvents = response.items
        .filter((item) => {
          if (item.homeVisible === false) return false;
          const state = getEventArticleState(item, referenceTime);
          return state === "open" || (state === "before_open" && startsWithinNextMonth(item.eventStartDate ?? null, referenceTime));
        })
        .map((item) => {
          const eventState = getEventArticleState(item, referenceTime);
          return {
            id: item.articleId,
            titleKo: item.titleKo,
            titleEn: item.titleEn,
            descriptionKo: item.eventDescriptionKo ?? item.titleKo,
            descriptionEn: item.eventDescriptionEn || item.titleEn || item.eventDescriptionKo || item.titleKo,
            imageUrl: item.thumbnailStorageKey
              ? resolveAssetUrl(item.thumbnailStorageKey)
              : null,
            palette: resolvePalette(item.articleId),
            isPinned: item.isPinned,
            pinOrder: item.pinOrder ?? null,
            homeVisible: item.homeVisible !== false,
            homeOrder: item.homeOrder ?? null,
            startAt: item.eventStartDate ?? null,
            endAt: item.eventEndDate ?? null,
            location: item.eventLocation ?? null,
            eventState,
            surveyId: item.surveyId ?? item.survey?.surveyId ?? null,
            linkedSurveyState: normalizeEventState(item.survey?.computedState),
            linkedSurveyMaxResponses: item.survey?.maxResponses ?? null,
            linkedSurveyResponseCount: item.survey?.responseCount ?? 0,
          };
        })
        .sort((a, b) => compareEventCards(a, b, referenceTime));
      setEvents(nextEvents);
      setLoading(false);
    }).catch((error) => {
      console.error(error);
      if (active) {
        setEvents([]);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [apiClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const localizedEvents = useMemo(() => events.map((event) => localizeEvent(event, lang)), [events, lang]);
  const pageSize = isMobile ? 1 : 3;
  const pages = useMemo(() => {
    const result: EventCardItem[][] = [];
    for (let index = 0; index < localizedEvents.length; index += pageSize) result.push(localizedEvents.slice(index, index + pageSize));
    return result;
  }, [localizedEvents, pageSize]);
  const totalPages = pages.length;
  const pageGap = isMobile ? 0 : 24;

  useEffect(() => setCurrentPage(0), [pageSize, localizedEvents.length]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof window === "undefined") return;
    const update = () => setViewportWidth(viewport.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [totalPages]);

  useEffect(() => {
    if (loading || hasEnteredViewport) return;

    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8%" },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, [hasEnteredViewport, loading]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (totalPages <= 1) return;
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragPointerIdRef.current = event.pointerId;
    dragMovedRef.current = false;
    dragAxisRef.current = null;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null || dragStartYRef.current === null) return;
    const deltaX = event.clientX - dragStartXRef.current;
    const deltaY = event.clientY - dragStartYRef.current;
    if (dragAxisRef.current === null) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        dragAxisRef.current = "y";
        dragStartXRef.current = null;
        dragStartYRef.current = null;
        return;
      }
      dragAxisRef.current = "x";
    }
    if (dragAxisRef.current !== "x") return;
    if (!dragMovedRef.current) {
      dragMovedRef.current = true;
      suppressClickRef.current = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const beyondStart = currentPage === 0 && deltaX > 0;
    const beyondEnd = currentPage === totalPages - 1 && deltaX < 0;
    setDragOffset(beyondStart || beyondEnd ? deltaX * 0.14 : deltaX);
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return;
    const delta = event.clientX - dragStartXRef.current;
    const threshold = Math.max(36, (viewportWidth || 360) * 0.08);
    const didMove = dragMovedRef.current;
    if (didMove && Math.abs(delta) >= threshold) {
      const movedPages = Math.max(1, Math.round(Math.abs(delta) / Math.max(1, viewportWidth + pageGap)));
      const direction = delta < 0 ? 1 : -1;
      setCurrentPage((page) => Math.max(0, Math.min(totalPages - 1, page + direction * movedPages)));
    }
    if (dragPointerIdRef.current !== null && event.currentTarget.hasPointerCapture(dragPointerIdRef.current)) {
      event.currentTarget.releasePointerCapture(dragPointerIdRef.current);
    }
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    dragPointerIdRef.current = null;
    dragMovedRef.current = false;
    dragAxisRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
    if (didMove) window.setTimeout(() => { suppressClickRef.current = false; }, 250);
  };

  if (loading) return <EventCarouselSkeleton />;

  return (
    <section
      ref={sectionRef}
      className="home-events-section"
      aria-labelledby="home-events-title"
    >
      <div className="home-section-heading home-section-heading-row">
        <div>
          <h2 id="home-events-title">{lang === "ko" ? "행사" : "Events"}</h2>
        </div>
        <Link to="/events" className="home-section-link">
          {lang === "ko" ? "행사 전체 보기" : "View all events"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {localizedEvents.length === 0 ? (
        <div className="home-events-empty">{lang === "ko" ? "현재 예정된 행사가 없습니다." : "There are no upcoming events."}</div>
      ) : (
        <div className="group relative">
              <div
                ref={viewportRef}
                className={`touch-pan-y select-none overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerDrag}
                onPointerCancel={finishPointerDrag}
                onDragStart={(dragEvent) => dragEvent.preventDefault()}
                onClickCapture={(clickEvent) => {
                  if (!suppressClickRef.current) return;
                  clickEvent.preventDefault();
                  clickEvent.stopPropagation();
                  suppressClickRef.current = false;
                }}
              >
                <div
                  className={`home-carousel-track flex ${isDragging ? "home-carousel-track-dragging" : ""}`}
                  style={{ transform: `translate3d(${-currentPage * (viewportWidth + pageGap) + dragOffset}px, 0, 0)` }}
                >
                  {pages.map((page, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="grid flex-shrink-0 gap-6 md:grid-cols-3"
                      style={{ width: viewportWidth ? `${viewportWidth}px` : "100%", marginRight: pageIndex < pages.length - 1 ? `${pageGap}px` : undefined }}
                    >
                      {page.map((event, eventIndex) => (
                        <EventCard
                          key={event.id}
                          enter={hasEnteredViewport}
                          enterIndex={eventIndex}
                          event={event}
                          lang={lang}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {totalPages > 1 && currentPage > 0 ? (
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} className="home-events-navigation left-2 !rounded-full" aria-label={lang === "ko" ? "이전 행사" : "Previous events"}>
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </IconButton>
              ) : null}
              {totalPages > 1 && currentPage < totalPages - 1 ? (
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} className="home-events-navigation right-2 !rounded-full" aria-label={lang === "ko" ? "다음 행사" : "Next events"}>
                  <ChevronRight aria-hidden="true" className="size-5" />
                </IconButton>
              ) : null}

              {totalPages > 1 ? (
                <div className="mt-6 flex justify-center gap-2">
                  {pages.map((_, index) => (
                    <Button key={index} type="button" variant="ghost" className={`h-1.5 min-h-0 border-0 p-0 ${index === currentPage ? "w-5 bg-slate-700" : "w-1.5 bg-slate-300"}`} onClick={() => setCurrentPage(index)} aria-label={`${index + 1}`} aria-current={index === currentPage ? "page" : undefined} />
                  ))}
                </div>
              ) : null}
        </div>
      )}
    </section>
  );
}
