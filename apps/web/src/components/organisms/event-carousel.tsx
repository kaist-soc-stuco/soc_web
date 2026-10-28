import { createApiClient } from "@soc/api-client";
import { isoToMs, msToDate, nowMs } from "@soc/shared";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";

import { EventCardFallback } from "@/components/organisms/event-card-fallback";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatCompactDateTime, getEventArticleState, getDiscoveryBadge } from "@/lib/events-surveys";

interface EventCardRecord {
  id: string;
  imageUrl: string | null;
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
  locationEn: string | null;
  eventState: "before_open" | "open" | "closed";
  surveyId: string | null;
  linkedSurveyState: "before_open" | "open" | "closed" | null;
  linkedSurveyClosesAt: string | null;
  linkedSurveyAlwaysOpen: boolean;
  linkedSurveyMaxResponses: number | null;
  linkedSurveyResponseCount: number;
}

interface EventCardItem {
  id: string;
  imageUrl: string | null;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  eventState: "before_open" | "open" | "closed";
  surveyId: string | null;
  linkedSurveyState: "before_open" | "open" | "closed" | null;
  linkedSurveyClosesAt: string | null;
  linkedSurveyAlwaysOpen: boolean;
  linkedSurveyMaxResponses: number | null;
  linkedSurveyResponseCount: number;
}

type EventSortRecord = Pick<EventCardRecord, "isPinned" | "pinOrder" | "homeOrder" | "startAt" | "endAt">;

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

function formatEventTime(value: string | null) {
  if (!value) return null;
  const timestamp = isoToMs(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = msToDate(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatEventDateTimeRange(startAt: string | null, endAt: string | null) {
  const dateRange = formatEventDateRange(startAt, endAt);
  const start = formatEventTime(startAt);
  const end = formatEventTime(endAt);
  const timeRange = start && end && start !== end
    ? `${start} – ${end}`
    : start || end;

  return [dateRange, timeRange].filter(Boolean).join(" · ") || null;
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
    title: lang === "ko" ? record.titleKo : record.titleEn || record.titleKo,
    description: lang === "ko"
      ? record.descriptionKo || record.titleKo
      : record.descriptionEn || record.titleEn || record.descriptionKo || record.titleKo,
    startAt: record.startAt,
    endAt: record.endAt,
    location: lang === "en" ? record.locationEn || record.location : record.location,
    eventState: record.eventState,
    surveyId: record.surveyId,
    linkedSurveyState: record.linkedSurveyState,
    linkedSurveyClosesAt: record.linkedSurveyClosesAt,
    linkedSurveyAlwaysOpen: record.linkedSurveyAlwaysOpen,
    linkedSurveyMaxResponses: record.linkedSurveyMaxResponses,
    linkedSurveyResponseCount: record.linkedSurveyResponseCount,
  };
}

function EventImage({ event }: { event: EventCardItem }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [event.imageUrl]);
  if (!event.imageUrl || failed) return <EventCardFallback />;
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

function EventStatusBadge({ event, lang }: { event: EventCardItem; lang: string }) {
  const status = getDiscoveryBadge({
    kind: "EVENT",
    computedState: event.eventState,
    opensAt: event.startAt,
    closesAt: event.endAt,
    linkedSurveyState: event.linkedSurveyState,
    linkedSurveyClosesAt: event.linkedSurveyClosesAt,
    linkedSurveyAlwaysOpen: event.linkedSurveyAlwaysOpen,
    linkedSurveyMaxResponses: event.linkedSurveyMaxResponses,
    linkedSurveyResponseCount: event.linkedSurveyResponseCount,
  }, lang);
  return status.label ? (
    <span className={`home-portal-event-badge is-${status.tone}`} title={status.deadline ? `${formatCompactDateTime(status.deadline)} (KST)` : undefined}>
      {status.label}
    </span>
  ) : null;
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
  const dateTimeRange = formatEventDateTimeRange(event.startAt, event.endAt);
  const location = event.location?.trim();
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
      </div>
      <div className="home-portal-event-body break-keep">
        <div className="home-portal-event-badges empty:hidden">
          <EventStatusBadge event={event} lang={lang} />
        </div>
        <h3 className="line-clamp-2">{event.title}</h3>
        {event.description ? <p className="line-clamp-2">{event.description}</p> : null}
        <div className="home-portal-event-meta">
          {dateTimeRange ? (
            <time className="home-portal-event-time">
              <Clock aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{dateTimeRange}</span>
            </time>
          ) : null}
          <div className={`home-portal-event-location flex min-w-0 items-center gap-1.5 ${location ? "" : "text-slate-400"}`}>
            {location ? (
              <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
            ) : (
              <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-slate-300" />
            )}
            <span className="truncate">
              {location ?? (lang === "ko" ? "장소 미정" : "Location TBD")}
            </span>
          </div>
        </div>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className={`overflow-hidden rounded-xl border border-slate-200 ${index > 0 ? "hidden sm:block" : ""}`}
          >
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
  const [isTablet, setIsTablet] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
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
    setLoading(true);
    setLoadError(false);
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
            imageUrl: item.thumbnailStorageKey?.trim()
              ? resolveAssetUrl(item.thumbnailStorageKey.trim())
              : null,
            isPinned: item.isPinned,
            pinOrder: item.pinOrder ?? null,
            homeVisible: item.homeVisible !== false,
            homeOrder: item.homeOrder ?? null,
            startAt: item.eventStartDate ?? null,
            endAt: item.eventEndDate ?? null,
            location: item.eventLocation ?? null,
            locationEn: item.eventLocationEn ?? null,
            eventState,
            surveyId: item.surveyId ?? item.survey?.surveyId ?? null,
            linkedSurveyState: normalizeEventState(item.survey?.computedState),
            linkedSurveyClosesAt: item.survey?.closeAt ?? null,
            linkedSurveyAlwaysOpen: item.survey?.isAlwaysOpen ?? false,
            linkedSurveyMaxResponses: item.survey?.maxResponses ?? null,
            linkedSurveyResponseCount: item.survey?.responseCount ?? 0,
          };
        })
        .sort((a, b) => compareEventCards(a, b, referenceTime));
      setEvents(nextEvents);
      setLoadError(false);
      setLoading(false);
    }).catch((error) => {
      console.error(error);
      if (active) {
        setEvents([]);
        setLoadError(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [apiClient, retryCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobileQuery = window.matchMedia("(width < 768px)");
    const tabletQuery = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      setIsMobile(mobileQuery.matches);
      setIsTablet(tabletQuery.matches);
    };
    update();
    mobileQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
    };
  }, []);

  const localizedEvents = useMemo(() => events.map((event) => localizeEvent(event, lang)), [events, lang]);
  const pageSize = isMobile ? 1 : isTablet ? 2 : 3;
  const pages = useMemo(() => {
    const result: EventCardItem[][] = [];
    for (let index = 0; index < localizedEvents.length; index += pageSize) result.push(localizedEvents.slice(index, index + pageSize));
    return result;
  }, [localizedEvents, pageSize]);
  const totalPages = pages.length;
  const pageGap = isMobile ? 16 : 24;
  const hasMobilePeek = isMobile && totalPages > 1;
  const pageWidth = hasMobilePeek ? Math.max(0, viewportWidth - 72) : viewportWidth;

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
      const movedPages = Math.max(1, Math.round(Math.abs(delta) / Math.max(1, pageWidth + pageGap)));
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

  if (loadError) {
    return (
      <section className="home-events-section" aria-labelledby="home-events-title">
        <div className="home-section-heading home-section-heading-row">
          <h2 id="home-events-title">
            <Link to="/events" className="home-heading-link">
              {lang === "ko" ? "행사" : "Events"}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </h2>
        </div>
        <div className="home-data-error" role="alert">
          <p>{lang === "ko" ? "행사를 불러오지 못했습니다." : "We couldn't load events."}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            {lang === "ko" ? "다시 시도" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="home-events-section"
      aria-labelledby="home-events-title"
    >
      <div className="home-section-heading home-section-heading-row">
        <h2 id="home-events-title">
          <Link to="/events" className="home-heading-link">
            {lang === "ko" ? "행사" : "Events"}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </h2>
      </div>

      {localizedEvents.length === 0 ? (
        <div className="home-events-empty">{lang === "ko" ? "현재 예정된 행사가 없습니다." : "There are no upcoming events."}</div>
      ) : (
        <div className="group relative">
              <div
                ref={viewportRef}
                className={`home-carousel-viewport touch-pan-y select-none overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                data-mobile-peek={hasMobilePeek || undefined}
                role="region"
                aria-label={lang === "ko" ? "행사 목록" : "Event carousel"}
                tabIndex={0}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                  event.preventDefault();
                  setCurrentPage(page => Math.max(0, Math.min(totalPages - 1, page + (event.key === "ArrowRight" ? 1 : -1))));
                }}
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
                  style={{ transform: `translate3d(${-currentPage * (pageWidth + pageGap) + dragOffset}px, 0, 0)` }}
                >
                  {pages.map((page, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="home-carousel-page grid flex-shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      style={{ width: pageWidth ? `${pageWidth}px` : "100%", marginRight: pageIndex < pages.length - 1 ? `${pageGap}px` : undefined }}
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
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} className="home-events-navigation left-2 !rounded-full !hidden md:!flex" aria-label={lang === "ko" ? "이전 행사" : "Previous events"}>
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </IconButton>
              ) : null}
              {totalPages > 1 && currentPage < totalPages - 1 ? (
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} className="home-events-navigation right-2 !rounded-full !hidden md:!flex" aria-label={lang === "ko" ? "다음 행사" : "Next events"}>
                  <ChevronRight aria-hidden="true" className="size-5" />
                </IconButton>
              ) : null}

              {totalPages > 1 ? (
                <>
                <div className="mobile-carousel-pagination md:hidden" role="status" aria-live="polite">
                  <span className="sr-only">{lang === "ko" ? `행사 ${currentPage + 1}/${totalPages}페이지` : `Event page ${currentPage + 1} of ${totalPages}`}</span>
                  {pages.map((_, index) => <span key={index} aria-hidden="true" className={index === currentPage ? "is-current" : undefined} />)}
                </div>
                <div className="mt-4 hidden justify-center gap-1 md:flex" aria-label={lang === "ko" ? "행사 페이지" : "Event pages"}>
                  {pages.map((_, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      className="flex size-11 min-h-11 items-center justify-center border-0 p-0"
                      onClick={() => setCurrentPage(index)}
                      aria-label={lang === "ko" ? `행사 ${index + 1}페이지` : `Event page ${index + 1}`}
                      aria-current={index === currentPage ? "page" : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className={`block rounded-full ${index === currentPage ? "h-1.5 w-5 bg-slate-700" : "size-1.5 bg-slate-300"}`}
                      />
                    </Button>
                  ))}
                </div>
                </>
              ) : null}
        </div>
      )}
    </section>
  );
}
