import { createApiClient } from "@soc/api-client";
import { isoToMs, msToDate, nowMs } from "@soc/shared";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  startAt: string | null;
  endAt: string | null;
}

interface EventCardItem {
  id: string;
  imageUrl: string | null;
  palette: string;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string | null;
}

type EventSortRecord = Pick<EventCardRecord, "isPinned" | "pinOrder" | "startAt" | "endAt">;
type EventCardStatus = { text: string; tone: "upcoming" | "active" };

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

function getEventCardStatus(startAt: string | null, endAt: string | null, lang: string): EventCardStatus {
  const currentTime = nowMs();
  const start = startAt ? Date.parse(startAt) : Number.NaN;
  const startDate = formatEventStatusDate(startAt);
  const endDate = formatEventStatusDate(endAt);
  if (Number.isFinite(start) && currentTime < start) {
    return {
      text: lang === "ko" ? `시작 예정${startDate ? ` (${startDate}～)` : ""}` : `Upcoming${startDate ? ` (${startDate}–)` : ""}`,
      tone: "upcoming",
    };
  }
  return {
    text: lang === "ko" ? `진행 중${endDate ? ` (～${endDate})` : ""}` : `In progress${endDate ? ` (–${endDate})` : ""}`,
    tone: "active",
  };
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
  };
}

function EventFallback({ event }: { event: EventCardItem }) {
  return (
    <div className={`home-event-fallback ${event.palette}`} aria-hidden="true">
      <span className="home-event-fallback-mark">SOC</span>
      <span className="home-event-fallback-date">
        {formatEventStatusDate(event.startAt) ?? "SOC"}
      </span>
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

function StatusChip({ event, lang }: { event: EventCardItem; lang: string }) {
  const status = getEventCardStatus(event.startAt, event.endAt, lang);
  return <span className={`home-editorial-status home-editorial-status-${status.tone}`}>{status.text}</span>;
}

function FeaturedEvent({ event, lang }: { event: EventCardItem; lang: string }) {
  return (
    <Link to={`/events/${encodeURIComponent(event.id)}`} draggable={false} className="home-featured-event group">
      <div className="home-featured-event-media"><EventImage event={event} /></div>
      <div className="home-featured-event-copy">
        <StatusChip event={event} lang={lang} />
        <h3>{event.title}</h3>
        {event.description ? <p>{event.description}</p> : null}
        <span className="home-featured-event-link">
          {lang === "ko" ? "행사 자세히 보기" : "View event"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function EventCard({ event, lang }: { event: EventCardItem; lang: string }) {
  return (
    <Link
      to={`/events/${encodeURIComponent(event.id)}`}
      draggable={false}
      onDragStart={(dragEvent) => dragEvent.preventDefault()}
      className="home-editorial-event-card group"
    >
      <div className="home-editorial-event-copy">
        <div className="flex w-full items-start justify-between gap-4">
          <span className="home-editorial-event-date">{formatEventStatusDate(event.startAt) ?? "SOC"}</span>
          <StatusChip event={event} lang={lang} />
        </div>
        <h3 className="line-clamp-2">{event.title}</h3>
        {event.description ? <p className="line-clamp-2">{event.description}</p> : null}
      </div>
    </Link>
  );
}

function EventCarouselSkeleton() {
  return (
    <section className="home-events-section" aria-hidden="true">
      <div className="home-section-heading">
        <div className="home-loading-surface h-3 w-16 rounded" />
        <div className="home-loading-surface mt-3 h-8 w-44 rounded" />
      </div>
      <div className="home-featured-event overflow-hidden">
        <div className="home-loading-surface min-h-80" />
        <div className="space-y-4 p-8">
          <div className="home-loading-surface h-5 w-24 rounded" />
          <div className="home-loading-surface h-10 w-4/5 rounded" />
          <div className="home-loading-surface h-4 w-full rounded" />
        </div>
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
  const viewportRef = useRef<HTMLDivElement>(null);
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
          const state = getEventArticleState(item, referenceTime);
          return state === "open" || (state === "before_open" && startsWithinNextMonth(item.eventStartDate ?? null, referenceTime));
        })
        .map((item) => ({
          id: item.articleId,
          titleKo: item.titleKo,
          titleEn: item.titleEn,
          descriptionKo: item.eventDescriptionKo ?? item.titleKo,
          descriptionEn: item.eventDescriptionEn || item.titleEn || item.eventDescriptionKo || item.titleKo,
          imageUrl: item.thumbnailStorageKey ? resolveAssetUrl(item.thumbnailStorageKey) : null,
          palette: resolvePalette(item.articleId),
          isPinned: item.isPinned,
          pinOrder: item.pinOrder ?? null,
          startAt: item.eventStartDate ?? null,
          endAt: item.eventEndDate ?? null,
        }))
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
  const featuredEvent = localizedEvents[0];
  const remainingEvents = localizedEvents.slice(1);
  const pageSize = isMobile ? 1 : 3;
  const pages = useMemo(() => {
    const result: EventCardItem[][] = [];
    for (let index = 0; index < remainingEvents.length; index += pageSize) result.push(remainingEvents.slice(index, index + pageSize));
    return result;
  }, [remainingEvents, pageSize]);
  const totalPages = pages.length;
  const pageGap = isMobile ? 0 : 24;

  useEffect(() => setCurrentPage(0), [pageSize, remainingEvents.length]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof window === "undefined") return;
    const update = () => setViewportWidth(viewport.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [totalPages]);

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
    <section className="home-events-section" aria-labelledby="home-events-title">
      <div className="home-section-heading home-section-heading-row">
        <div>
          <p className="home-section-kicker">EVENTS</p>
          <h2 id="home-events-title">{lang === "ko" ? "다가오는 행사" : "Upcoming events"}</h2>
        </div>
        <Link to="/events" className="home-section-link">
          {lang === "ko" ? "행사 전체 보기" : "View all events"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {!featuredEvent ? (
        <div className="home-events-empty">{lang === "ko" ? "현재 예정된 행사가 없습니다." : "There are no upcoming events."}</div>
      ) : (
        <>
          <FeaturedEvent event={featuredEvent} lang={lang} />
          {remainingEvents.length > 0 ? (
            <div className="group relative mt-6">
              <div
                ref={viewportRef}
                className={`touch-pan-y overflow-hidden ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
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
                      {page.map((event) => <EventCard key={event.id} event={event} lang={lang} />)}
                    </div>
                  ))}
                </div>
              </div>

              {totalPages > 1 && currentPage > 0 ? (
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} className="home-events-navigation left-0 -translate-x-1/2" aria-label={lang === "ko" ? "이전 행사" : "Previous events"}>
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </IconButton>
              ) : null}
              {totalPages > 1 && currentPage < totalPages - 1 ? (
                <IconButton size="lg" tone="navigation" onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} className="home-events-navigation right-0 translate-x-1/2" aria-label={lang === "ko" ? "다음 행사" : "Next events"}>
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
          ) : null}
        </>
      )}
    </section>
  );
}
