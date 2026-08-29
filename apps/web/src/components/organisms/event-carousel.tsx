import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { isoToMs, msToDate, nowMs } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getEventArticleState } from "@/lib/events-surveys";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ErrorState } from "@/components/ui/data-state";

interface EventCardRecord {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
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
  fallbackClassName: string;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string | null;
}

interface EventCardProps {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string | null;
  lang: string;
}

type EventCardStatus = {
  text: string;
  tone: "upcoming" | "active";
};

type EventSortRecord = Pick<
  EventCardRecord,
  "isPinned" | "pinOrder" | "startAt" | "endAt"
>;

function getEventSortGroup(event: EventSortRecord, referenceTime: number) {
  if (event.isPinned) return 0;
  const start = event.startAt ? Date.parse(event.startAt) : Number.NaN;
  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
  if (
    (!Number.isFinite(start) || start <= referenceTime) &&
    (!Number.isFinite(end) || referenceTime <= end)
  ) {
    return 1;
  }
  if (Number.isFinite(start) && referenceTime < start) return 2;
  return 3;
}

function compareEventCards(
  a: EventSortRecord,
  b: EventSortRecord,
  referenceTime: number,
) {
  const aGroup = getEventSortGroup(a, referenceTime);
  const bGroup = getEventSortGroup(b, referenceTime);
  if (aGroup !== bGroup) return aGroup - bGroup;

  if (a.isPinned && b.isPinned) {
    const pinOrderDifference =
      (a.pinOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.pinOrder ?? Number.MAX_SAFE_INTEGER);
    if (pinOrderDifference !== 0) return pinOrderDifference;
  }

  if (aGroup === 1) {
    const aEnd = Date.parse(a.endAt ?? "") || Number.MAX_SAFE_INTEGER;
    const bEnd = Date.parse(b.endAt ?? "") || Number.MAX_SAFE_INTEGER;
    return aEnd - bEnd;
  }

  const aStart = Date.parse(a.startAt ?? "") || Number.MAX_SAFE_INTEGER;
  const bStart = Date.parse(b.startAt ?? "") || Number.MAX_SAFE_INTEGER;
  return aStart - bStart;
}

function startsWithinNextMonth(
  startAt: string | null,
  referenceTime: number,
) {
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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function getEventCardStatus(
  startAt: string | null,
  endAt: string | null,
  lang: string,
): EventCardStatus {
  const now = nowMs();
  const start = startAt ? Date.parse(startAt) : Number.NaN;
  const end = endAt ? Date.parse(endAt) : Number.NaN;
  const startDateText = formatEventStatusDate(startAt);
  const endDateText = formatEventStatusDate(endAt);

  if (Number.isFinite(start) && now < start) {
    return {
      text:
        lang === "ko"
          ? `시작 예정${startDateText ? ` (${startDateText}～)` : ""}`
          : `Upcoming${startDateText ? ` (${startDateText}–)` : ""}`,
      tone: "upcoming",
    };
  }

  if (!Number.isFinite(end) || now <= end) {
    return {
      text:
        lang === "ko"
          ? `진행 중${endDateText ? ` (～${endDateText})` : ""}`
          : `In progress${endDateText ? ` (–${endDateText})` : ""}`,
      tone: "active",
    };
  }

  return {
    text: lang === "ko" ? "상시" : "Open",
    tone: "active",
  };
}

function EventCard({
  id,
  imageUrl,
  fallbackClassName,
  title,
  description,
  startAt,
  endAt,
  lang,
}: EventCardProps) {
  const isMock = id.startsWith("mock-");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const cardContent = (
    <article className="home-event-card group">
      <div className={`home-event-art ${fallbackClassName}`} aria-hidden="true" />
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImageFailed(true)}
          className="home-event-image"
        />
      ) : null}
      <div className="home-event-overlay" aria-hidden="true" />

      <div className="home-event-content">
        <div className="home-event-status" aria-label={lang === "ko" ? "행사 상태" : "Event status"}>
          {(() => {
            const status = getEventCardStatus(startAt, endAt, lang);
            return (
              <span className={`home-event-chip home-event-chip-${status.tone}`}>
                {status.text}
              </span>
            );
          })()}
        </div>
        <h3 className="home-event-title line-clamp-2">
          {title}
        </h3>
        <p className="home-event-description">
          {description ?? ""}
        </p>
      </div>
    </article>
  );

  if (isMock) {
    return <div className="block h-full w-full">{cardContent}</div>;
  }

  return (
    <Link
      aria-label={title}
      to={`/events/${encodeURIComponent(id)}`}
      className="block h-full w-full"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
    >
      {cardContent}
    </Link>
  );
}

const FALLBACK_CLASS_NAMES = [
  "home-event-art-green",
  "home-event-art-purple",
  "home-event-art-blue",
  "home-event-art-gold",
] as const;

function resolveFallbackClassName(id: string) {
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_CLASS_NAMES[hash % FALLBACK_CLASS_NAMES.length];
}

function localizeEvent(record: EventCardRecord, lang: string): EventCardItem {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    fallbackClassName: record.fallbackClassName,
    title:
      lang === "ko" ? record.titleKo : record.titleEn || record.titleKo,
    description:
      lang === "ko"
        ? record.descriptionKo || record.titleKo
        : record.descriptionEn ||
          record.titleEn ||
          record.descriptionKo ||
          record.titleKo,
    startAt: record.startAt,
    endAt: record.endAt,
  };
}

function EventCarouselSkeleton({ lang }: { lang: string }) {
  const cards = Array.from({ length: 3 });

  return (
    <section
      aria-label={lang === "ko" ? "주요 행사" : "Featured events"}
      className="min-w-0 max-w-full bg-transparent"
    >
      <div className="max-w-full overflow-hidden">
        <div className="grid grid-cols-3 gap-4">
          {cards.map((_, index) => (
            <div
              key={index}
              className={`home-event-card home-loading-surface relative overflow-hidden ${
                index === 0 ? "" : "hidden md:block"
              }`}
            >
              <div className="absolute inset-x-0 top-0 aspect-video border-b border-slate-200 bg-white/25 p-4">
                <div className="h-full w-full rounded-lg bg-white/25" />
              </div>
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 p-4">
                <div className="h-4 w-2/3 rounded bg-white/55" />
                <div className="mt-3 h-3 w-full rounded bg-white/35" />
                <div className="mt-2 h-3 w-4/5 rounded bg-white/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex h-1.5 items-center justify-center gap-2">
        <div className="home-loading-surface h-1.5 w-4 rounded-full" />
        <div className="home-loading-surface h-1.5 w-1.5 rounded-full" />
      </div>
    </section>
  );
}

export function EventCarousel() {
  const { lang } = useLanguage();
  const [currentPage, setCurrentPage] = useState(0);
  const [events, setEvents] = useState<EventCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragAxisRef = useRef<"x" | "y" | null>(null);
  const suppressClickRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const referenceTime = nowMs();
        const res = await apiClient.getArticles("_EVENT", { limit: 12 });
        const eventCards = res.items
          .filter((item) => getEventArticleState(item) !== "closed")
          .filter((item) =>
            startsWithinNextMonth(item.eventStartDate ?? null, referenceTime),
          )
          .map((item) => ({
            id: item.articleId,
            titleKo: item.titleKo,
            titleEn: item.titleEn,
            descriptionKo: item.eventDescriptionKo ?? item.titleKo,
            descriptionEn:
              item.eventDescriptionEn ||
              item.titleEn ||
              item.eventDescriptionKo ||
              item.titleKo,
            imageUrl: item.thumbnailStorageKey
              ? resolveAssetUrl(item.thumbnailStorageKey)
              : null,
            fallbackClassName: resolveFallbackClassName(item.articleId),
            isPinned: item.isPinned,
            pinOrder: item.pinOrder ?? null,
            startAt: item.eventStartDate ?? null,
            endAt: item.eventEndDate ?? null,
          }))
          .sort((a, b) => compareEventCards(a, b, referenceTime));
        if (active) {
          setLoadError(false);
          setEvents(eventCards);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setLoadError(true);
          setEvents([]);
          setLoading(false);
        }
      }
    };

    void loadEvents();
    return () => {
      active = false;
    };
  }, [apiClient]);

  const displayEvents = useMemo(
    () => events.map((event) => localizeEvent(event, lang)),
    [events, lang],
  );
  const pageSize = isMobile ? 1 : 3;
  const pageGap = isMobile ? 0 : 16;
  const pageWidth = viewportWidth;
  const slideDistance =
    !isMobile && pageWidth > 0 ? currentPage * (pageWidth + pageGap) : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    if (loading || events.length === 0) return;

    const viewport = viewportRef.current;
    if (!viewport || typeof window === "undefined") return;

    const updateWidth = () => {
      setViewportWidth(viewport.getBoundingClientRect().width);
    };

    updateWidth();
    const timeoutId = window.setTimeout(updateWidth, 0);
    window.addEventListener("resize", updateWidth);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateWidth);
    };
  }, [events.length, isMobile, loading]);

  const chunkedPages = useMemo(() => {
    const pages: EventCardItem[][] = [];
    for (let i = 0; i < displayEvents.length; i += pageSize) {
      const chunk = displayEvents.slice(i, i + pageSize);
      if (chunk.length > 0) {
        pages.push(chunk);
      }
    }
    return pages;
  }, [displayEvents, pageSize]);

  const totalPages = chunkedPages.length;

  useEffect(() => {
    setCurrentPage(0);
  }, [displayEvents.length, pageSize]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (totalPages <= 1) return;
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragPointerIdRef.current = event.pointerId;
    dragMovedRef.current = false;
    dragAxisRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      dragStartXRef.current === null ||
      dragStartYRef.current === null
    ) {
      return;
    }

    const delta = event.clientX - dragStartXRef.current;
    const verticalDelta = event.clientY - dragStartYRef.current;

    if (dragAxisRef.current === null) {
      if (Math.max(Math.abs(delta), Math.abs(verticalDelta)) < 8) return;
      if (Math.abs(verticalDelta) > Math.abs(delta)) {
        dragAxisRef.current = "y";
        dragStartXRef.current = null;
        dragStartYRef.current = null;
        dragPointerIdRef.current = null;
        return;
      }
      dragAxisRef.current = "x";
    }

    if (dragAxisRef.current !== "x") return;

    if (!dragMovedRef.current) {
      dragMovedRef.current = true;
      suppressClickRef.current = true;
      setIsDragging(true);
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    const isPullingPastFirstPage = currentPage === 0 && delta > 0;
    const isPullingPastLastPage = currentPage === totalPages - 1 && delta < 0;
    setDragOffset(
      isPullingPastFirstPage || isPullingPastLastPage ? delta * 0.16 : delta,
    );
  };

  const finishPointerDrag = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (dragStartXRef.current === null) return;
    const delta = event.clientX - dragStartXRef.current;
    const threshold = Math.max(36, (viewportWidth || 360) * 0.08);
    const didMove = dragMovedRef.current;

    if (didMove && Math.abs(delta) >= threshold && totalPages > 1) {
      const pageDistance = Math.max(1, viewportWidth + pageGap);
      const movedPages = Math.max(1, Math.round(Math.abs(delta) / pageDistance));
      const direction = delta < 0 ? 1 : -1;
      setCurrentPage((page) =>
        Math.max(0, Math.min(totalPages - 1, page + direction * movedPages)),
      );
    }

    if (
      dragPointerIdRef.current !== null &&
      event.currentTarget.hasPointerCapture(dragPointerIdRef.current)
    ) {
      event.currentTarget.releasePointerCapture(dragPointerIdRef.current);
    }
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    dragPointerIdRef.current = null;
    dragMovedRef.current = false;
    dragAxisRef.current = null;
    setDragOffset(0);
    setIsDragging(false);

    if (didMove) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);
    }
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  if (loading && events.length === 0) {
    return <EventCarouselSkeleton lang={lang} />;
  }

  if (loadError) {
    return (
      <section
        aria-label={lang === "ko" ? "주요 행사" : "Featured events"}
        className="min-w-0 max-w-full bg-transparent"
      >
        <ErrorState
          className="home-event-card border-dashed bg-white"
          message={
            lang === "ko"
              ? "주요 행사를 불러오지 못했습니다."
              : "Featured events could not be loaded."
          }
        />
        <div className="mt-5 flex h-1.5 items-center justify-center" />
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section
        aria-label={lang === "ko" ? "주요 행사" : "Featured events"}
        className="min-w-0 max-w-full bg-transparent"
      >
        <div className="home-event-card items-center justify-center border-dashed bg-white">
          <p className="text-sm font-semibold text-slate-400">
            {lang === "ko"
              ? "표시할 주요 행사가 없습니다."
              : "No featured events to show."}
          </p>
        </div>
        <div className="mt-5 flex h-1.5 items-center justify-center" />
      </section>
    );
  }

  return (
    <section
      aria-label={lang === "ko" ? "주요 행사" : "Featured events"}
      className="min-w-0 max-w-full bg-transparent"
    >

      <div className="group relative flex items-center justify-center">
        {/* Sliding Page Viewport */}
        <div
          ref={viewportRef}
          className={`w-full touch-pan-y overflow-hidden ${
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={handleClickCapture}
        >
          <div
            className={`home-carousel-track flex transform-gpu ${
              isDragging
                ? "home-carousel-track-dragging"
                : ""
            }`}
            style={{
              transform: `translate3d(${-(isMobile ? currentPage * viewportWidth : slideDistance) + dragOffset}px, 0, 0)`,
            }}
          >
            {chunkedPages.map((pageItems, pageIdx) => {
              const featuredItem = pageItems[0];
              const standardItems = pageItems.slice(1);

              if (isMobile) {
                return (
                  <div
                    key={pageIdx}
                    className="w-full flex-shrink-0"
                  >
                    <div className="w-full">
                      <EventCard
                        id={featuredItem.id}
                        imageUrl={featuredItem.imageUrl}
                        fallbackClassName={featuredItem.fallbackClassName}
                        title={featuredItem.title}
                        description={featuredItem.description}
                        startAt={featuredItem.startAt}
                        endAt={featuredItem.endAt}
                        lang={lang}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={pageIdx}
                  className="flex-shrink-0 overflow-visible"
                  style={{
                    width: pageWidth > 0 ? `${pageWidth}px` : "100%",
                    marginRight:
                      pageIdx < chunkedPages.length - 1
                        ? `${pageGap}px`
                        : undefined,
                  }}
                >
                   <div
                   className={
                     pageItems.length === 1
                         ? "mx-auto grid w-full max-w-lg grid-cols-1 gap-4"
                         : pageItems.length === 2
                           ? "grid w-full grid-cols-2 gap-4"
                           : "grid w-full grid-cols-3 gap-4"
                     }
                   >
                    {/* Featured Card */}
                    <div className="min-h-0 min-w-0">
                      <EventCard
                        id={featuredItem.id}
                        imageUrl={featuredItem.imageUrl}
                        fallbackClassName={featuredItem.fallbackClassName}
                        title={featuredItem.title}
                        description={featuredItem.description}
                        startAt={featuredItem.startAt}
                        endAt={featuredItem.endAt}
                        lang={lang}
                      />
                    </div>

                    {/* Standard Cards */}
                    {standardItems.map((item) => (
                      <div key={item.id} className="min-h-0 min-w-0">
                        <EventCard
                          id={item.id}
                          imageUrl={item.imageUrl}
                          fallbackClassName={item.fallbackClassName}
                          title={item.title}
                          description={item.description}
                          startAt={item.startAt}
                          endAt={item.endAt}
                          lang={lang}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {totalPages > 1 ? (
          <>
            {currentPage > 0 ? (
            <IconButton
              size="lg"
              tone="navigation"
              onClick={handlePrevPage}
              className="interaction-button absolute left-3 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full bg-white/55 p-0 text-slate-700 opacity-75 transition-[opacity,background-color,color,transform] hover:bg-white/90 hover:text-slate-950 hover:opacity-100 focus-visible:opacity-100"
              aria-label={lang === "ko" ? "이전 행사" : "Previous events"}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </IconButton>
            ) : null}
            {currentPage < totalPages - 1 ? (
            <IconButton
              size="lg"
              tone="navigation"
              onClick={handleNextPage}
              className="interaction-button absolute right-3 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full bg-white/55 p-0 text-slate-700 opacity-75 transition-[opacity,background-color,color,transform] hover:bg-white/90 hover:text-slate-950 hover:opacity-100 focus-visible:opacity-100"
              aria-label={lang === "ko" ? "다음 행사" : "Next events"}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </IconButton>
            ) : null}
          </>
        ) : null}

      </div>

      {/* Page position remains visible while previous/next actions stay on hover. */}
      {totalPages > 1 && (
        <div className="mt-2 flex h-5 items-center justify-center">
          <div className="flex min-w-12 items-center justify-center gap-1.5" aria-label={lang === "ko" ? "행사 페이지" : "Event pages"}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button variant="ghost"
                key={i}
                type="button"
                onClick={() => setCurrentPage(i)}
                className={`interaction-button h-1.5 border-0 p-0 ${
                  i === currentPage
                    ? "w-4 rounded-full bg-slate-700"
                    : "w-1.5 rounded-full bg-slate-300 hover:bg-slate-400"
                }`}
                aria-current={i === currentPage ? "page" : undefined}
                aria-label={
                  lang === "ko"
                    ? `${i + 1}번째 행사 페이지로 이동`
                    : `Go to event page ${i + 1}`
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
