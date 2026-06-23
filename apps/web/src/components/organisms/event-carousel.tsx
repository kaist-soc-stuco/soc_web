import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { useLanguage } from "@/hooks/use-language";

interface EventCardRecord {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  titleKo: string;
  titleEn?: string | null;
  descriptionKo?: string;
  descriptionEn?: string;
}

interface EventCardItem {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  title: string;
  description?: string;
}

interface FeaturedCardProps {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  title: string;
  description?: string;
}

function FeaturedEventCard({
  id,
  imageUrl,
  fallbackClassName,
  title,
  description,
}: FeaturedCardProps) {
  const isMock = id.startsWith("mock-");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const cardContent = (
    <div className="group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[1.35rem] border border-white/15 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover select-none">
      <div className={`absolute inset-0 ${fallbackClassName}`} />
      {showImage && (
        <img
          src={imageUrl ?? undefined}
          alt=""
          aria-hidden="true"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        />
      )}
      {/* Dark overlay for readability */}
      <div
        className={
          showImage
            ? "absolute inset-0 bg-gradient-to-t from-black/68 via-black/30 to-black/0 transition-opacity duration-300 group-hover:opacity-90"
            : "absolute inset-0 bg-black/[0.08] transition-opacity duration-300 group-hover:opacity-80"
        }
      />

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col p-4">
        {/* Title */}
        <h3 className="home-card-title line-clamp-1 text-white transition-colors group-hover:text-white/88">
          {title}
        </h3>

        {/* Description */}
        <p className="home-card-body mt-1.5 h-10 line-clamp-2 text-stone-200/90">
          {description ?? ""}
        </p>
      </div>
    </div>
  );

  if (isMock) {
    return <div className="w-full h-full">{cardContent}</div>;
  }

  return (
    <Link to={`/board/행사/${id}`} className="w-full h-full block">
      {cardContent}
    </Link>
  );
}

interface StandardCardProps {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  isPeek?: boolean;
  title: string;
  description?: string;
}

function StandardEventCard({
  id,
  imageUrl,
  fallbackClassName,
  isPeek = false,
  title,
  description,
}: StandardCardProps) {
  const isMock = id.startsWith("mock-");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const cardContent = (
    <div className="group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[1.35rem] border border-white/15 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover select-none">
      <div className={`absolute inset-0 ${fallbackClassName}`} />
      {showImage && (
        <img
          src={imageUrl ?? undefined}
          alt=""
          aria-hidden="true"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        />
      )}
      {/* Dark overlay for readability */}
      <div
        className={
          showImage
            ? "absolute inset-0 bg-gradient-to-t from-black/68 via-black/30 to-black/0 transition-opacity duration-300 group-hover:opacity-90"
            : "absolute inset-0 bg-black/[0.08] transition-opacity duration-300 group-hover:opacity-80"
        }
      />

      {!isPeek && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col p-4">
          <h3 className="home-card-title line-clamp-1 text-white transition-colors group-hover:text-white/88">
            {title}
          </h3>

          <p className="home-card-body mt-1.5 h-10 line-clamp-2 text-stone-200/90">
            {description ?? ""}
          </p>
        </div>
      )}
    </div>
  );

  if (isMock) {
    return <div className="w-full h-full flex flex-col">{cardContent}</div>;
  }

  return (
    <Link
      to={`/board/행사/${id}`}
      className="w-full h-full block flex flex-col"
    >
      {cardContent}
    </Link>
  );
}

const FALLBACK_CLASS_NAMES = [
  "bg-[#123524]",
  "bg-[#173f5f]",
  "bg-[#24415f]",
  "bg-[#2b3a2f]",
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
  };
}

function EventCarouselSkeleton({ lang }: { lang: string }) {
  const cards = Array.from({ length: 3 });

  return (
    <section className="min-w-0 max-w-full min-h-[350px] bg-transparent select-none md:min-h-[400px]">
      <div className="w-full mb-4 flex items-center justify-between">
        <h2 className="home-section-title">
          {lang === "ko" ? "이번 주 주요 행사" : "Featured Events"}
        </h2>
        <div className="home-loading-surface h-4 w-14 rounded-full" />
      </div>
      <div className="max-w-full overflow-hidden">
        <div className="flex gap-6">
          {cards.map((_, index) => (
            <div
              key={index}
              className={`home-loading-surface relative h-[290px] overflow-hidden rounded-[1.35rem] md:h-[330px] md:flex-1 ${
                index === 0 ? "flex-[0_0_100%]" : "hidden md:block"
              }`}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/20 to-transparent p-4">
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
  const [isMobile, setIsMobile] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const res = await apiClient.getArticles("행사", { limit: 12 });
        const eventCards = res.items.map((item) => ({
          id: item.articleId,
          titleKo: item.titleKo,
          titleEn: item.titleEn,
          descriptionKo: item.eventDescription ?? item.titleKo,
          descriptionEn: item.titleEn || item.eventDescription || item.titleKo,
          imageUrl: item.thumbnailStorageKey
            ? resolveAssetUrl(item.thumbnailStorageKey)
            : null,
          fallbackClassName: resolveFallbackClassName(item.articleId),
        }));
        if (active) {
          setEvents(eventCards);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
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
  const pageGap = isMobile ? 0 : 36;
  const peekWidth = isMobile ? 0 : 112;
  const measuredPageWidth =
    viewportWidth > 0 ? Math.max(0, viewportWidth - peekWidth) : 0;
  const pageWidth = isMobile ? viewportWidth : measuredPageWidth;
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
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  if (loading && events.length === 0) {
    return <EventCarouselSkeleton lang={lang} />;
  }

  if (events.length === 0) {
    return (
      <section className="min-w-0 max-w-full min-h-[350px] bg-transparent select-none md:min-h-[400px]">
        <div className="w-full mb-4 flex items-center justify-between">
          <h2 className="home-section-title">
            {lang === "ko" ? "이번 주 주요 행사" : "Featured Events"}
          </h2>
          <Link
            to="/events-surveys"
            className="home-more-link"
          >
            <span>{lang === "ko" ? "더보기" : "More"}</span>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
        <div className="h-[290px] md:h-[315px] rounded-2xl border border-dashed border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.025)] flex items-center justify-center">
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
    <section className="min-w-0 max-w-full min-h-[350px] bg-transparent select-none md:min-h-[400px]">
      {/* Title Bar */}
      <div className="w-full mb-4 flex items-center justify-between">
        <h2 className="home-section-title flex items-center gap-1.5">
          {lang === "ko" ? "이번 주 주요 행사" : "Featured Events"}
        </h2>
        <Link
          to="/events-surveys"
          className="home-more-link"
        >
          <span>{lang === "ko" ? "더보기" : "More"}</span>
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      <div className="group/carousel relative flex items-center justify-center">
        {/* Sliding Page Viewport */}
        <div ref={viewportRef} className="w-full overflow-hidden">
          <div
            className="flex transform-gpu transition-transform duration-500 ease-in-out"
            style={{
              transform: isMobile
                ? `translateX(-${currentPage * 100}%)`
                : `translateX(-${slideDistance}px)`,
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
                    <div className="h-[260px]">
                      <FeaturedEventCard
                        id={featuredItem.id}
                        imageUrl={featuredItem.imageUrl}
                        fallbackClassName={featuredItem.fallbackClassName}
                        title={featuredItem.title}
                        description={featuredItem.description}
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
                  <div className="grid grid-cols-3 gap-6">
                    {/* Featured Card */}
                    <div className="h-[310px] min-w-0 md:h-[330px]">
                      <FeaturedEventCard
                        id={featuredItem.id}
                        imageUrl={featuredItem.imageUrl}
                        fallbackClassName={featuredItem.fallbackClassName}
                        title={featuredItem.title}
                        description={featuredItem.description}
                      />
                    </div>

                    {/* Standard Cards */}
                    {standardItems.map((item) => (
                      <div
                        key={item.id}
                        className="h-[310px] min-w-0 md:h-[330px]"
                      >
                        <StandardEventCard
                          id={item.id}
                          imageUrl={item.imageUrl}
                          fallbackClassName={item.fallbackClassName}
                          isPeek={false}
                          title={item.title}
                          description={item.description}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {totalPages > 1 && currentPage < totalPages - 1 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(to_left,#fafafa_0%,rgba(250,250,250,0.72)_38%,rgba(250,250,250,0.28)_72%,rgba(250,250,250,0)_100%)] opacity-70" />
        )}
        {totalPages > 1 && currentPage > 0 && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-[linear-gradient(to_right,#fafafa_0%,rgba(250,250,250,0.6)_46%,rgba(250,250,250,0.2)_76%,rgba(250,250,250,0)_100%)] opacity-60" />
        )}

        {/* Floating Right Arrow Button */}
        {totalPages > 1 && (
          <button
            onClick={handleNextPage}
            className="absolute right-3 z-20 w-8 h-8 rounded-full bg-white/95 shadow-card border border-card-border-subtle flex items-center justify-center text-slate-700 hover:text-brand-primary transition-all hover:scale-105 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
            aria-label={lang === "ko" ? "다음 행사" : "Next events"}
          >
            <ChevronRight className="h-4 w-4 stroke-[3px]" />
          </button>
        )}

        {/* Floating Left Arrow Button (Only show if not on page 0) */}
        {totalPages > 1 && currentPage > 0 && (
          <button
            onClick={handlePrevPage}
            className="absolute left-3 z-20 w-8 h-8 rounded-full bg-white/95 shadow-card border border-card-border-subtle flex items-center justify-center text-slate-700 hover:text-brand-primary transition-all hover:scale-105 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
            aria-label={lang === "ko" ? "이전 행사" : "Previous events"}
          >
            <ChevronLeft className="h-4 w-4 stroke-[3px]" />
          </button>
        )}
      </div>

      {/* Carousel Dots */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`transition-all duration-300 border-0 cursor-pointer ${
                i === currentPage
                  ? "h-1.5 w-4 bg-[#2b8a3e] rounded-full"
                  : "h-1.5 w-1.5 bg-[#dadce0] rounded-full hover:bg-slate-400"
              }`}
              aria-label={
                lang === "ko"
                  ? `${i + 1}번째 행사 페이지로 이동`
                  : `Go to event page ${i + 1}`
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
