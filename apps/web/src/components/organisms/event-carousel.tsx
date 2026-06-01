import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import type { ArticleDetailResponse } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";

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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-card hover:shadow-card-hover transition-all duration-300 select-none group flex flex-col justify-end">
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
            ? "absolute inset-0 bg-gradient-to-t from-black/78 via-black/35 to-black/5 transition-opacity duration-300 group-hover:opacity-95"
            : "absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:opacity-90"
        }
      />

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex flex-col">
        {/* Title */}
        <h3 className="text-base font-bold text-white leading-snug tracking-tight group-hover:text-[#86efac] transition-colors line-clamp-1">
          {title}
        </h3>

        {/* Description */}
        <p className="mt-1.5 h-10 text-xs font-normal leading-relaxed text-stone-200/90 line-clamp-2">
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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-card hover:shadow-card-hover transition-all duration-300 select-none group flex flex-col justify-end">
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
            ? "absolute inset-0 bg-gradient-to-t from-black/78 via-black/35 to-black/5 transition-opacity duration-300 group-hover:opacity-95"
            : "absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:opacity-90"
        }
      />

      {!isPeek && (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex flex-col">
          <h3 className="text-base font-bold text-white leading-snug tracking-tight group-hover:text-[#86efac] transition-colors line-clamp-1">
            {title}
          </h3>

          <p className="mt-1.5 h-10 text-xs font-normal leading-relaxed text-stone-200/90 line-clamp-2">
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

function resolveEventImageUrl(detail: ArticleDetailResponse) {
  const imageAsset = detail.assets?.find(
    (asset) =>
      asset.usageType === "THUMBNAIL" || asset.usageType === "IMAGE",
  );

  return imageAsset ? resolveAssetUrl(imageAsset.storageKey) : null;
}

function EventCarouselSkeleton() {
  return (
    <section className="h-full bg-transparent select-none">
      <div className="w-full mb-4 flex items-center justify-between">
        <h2 className="text-base lg:text-lg font-black text-kaist-black tracking-tight">
          이번 주 주요 행사
        </h2>
        <div className="h-4 w-12 rounded bg-slate-100" />
      </div>
      <div className="overflow-hidden">
        <div className="flex gap-6">
          <div className="h-[290px] flex-[0_0_100%] rounded-2xl bg-slate-100 animate-pulse md:h-[330px] md:flex-[0_0_31%]" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="hidden h-[330px] flex-[0_0_31%] rounded-2xl bg-slate-100 animate-pulse md:block"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function EventCarousel() {
  const [currentPage, setCurrentPage] = useState(0);
  const [events, setEvents] = useState<EventCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const res = await apiClient.getArticles("행사", { limit: 12 });
        const detailedEvents = await Promise.all(
          res.items.map(async (item) => {
            try {
              const detail = await apiClient.getArticle("행사", item.articleId);

              return {
                id: item.articleId,
                title: item.titleKo,
                description:
                  detail.eventDescription ??
                  item.eventDescription ??
                  item.titleKo,
                imageUrl: resolveEventImageUrl(detail),
                fallbackClassName: resolveFallbackClassName(item.articleId),
              };
            } catch {
              return {
                id: item.articleId,
                title: item.titleKo,
                description: item.eventDescription ?? item.titleKo,
                imageUrl: null,
                fallbackClassName: resolveFallbackClassName(item.articleId),
              };
            }
          }),
        );
        if (active) {
          setEvents(detailedEvents);
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

  const displayEvents = events;
  const pageSize = isMobile ? 1 : 4;

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
    return <EventCarouselSkeleton />;
  }

  if (events.length === 0) {
    return (
      <section className="h-full bg-transparent select-none">
        <div className="w-full mb-4 flex items-center justify-between">
          <h2 className="text-base lg:text-lg font-black text-kaist-black tracking-tight">
            이번 주 주요 행사
          </h2>
          <Link
            to="/events-surveys"
            className="text-[10px] font-bold text-kaist-grey hover:text-brand-primary transition-colors cursor-pointer"
          >
            더보기
          </Link>
        </div>
        <div className="h-[290px] md:h-[315px] rounded-2xl border border-dashed border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.025)] flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-400">
            표시할 주요 행사가 없습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full bg-transparent select-none">
      {/* Title Bar */}
      <div className="w-full mb-4 flex items-center justify-between">
        <h2 className="text-base lg:text-lg font-black text-kaist-black tracking-tight flex items-center gap-1.5">
          이번 주 주요 행사
        </h2>
        <Link
          to="/events-surveys"
          className="text-[10px] font-bold text-kaist-grey hover:text-brand-primary transition-colors cursor-pointer flex items-center gap-0.5"
        >
          <span>더보기</span>
          <svg
            className="w-2.5 h-2.5 text-slate-450"
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
        <div className="w-full overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(-${currentPage * 100}%)`,
            }}
          >
            {chunkedPages.map((pageItems, pageIdx) => {
              const featuredItem = pageItems[0];
              const standardItems = pageItems.slice(1);

              if (isMobile) {
                return (
                  <div key={pageIdx} className="w-full flex-shrink-0">
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
                <div key={pageIdx} className="w-full flex-shrink-0 overflow-hidden">
                  <div className="flex gap-6 pr-2">
                    {/* Featured Card */}
                    <div className="h-[310px] flex-[0_0_31%] md:h-[330px]">
                      <FeaturedEventCard
                        id={featuredItem.id}
                        imageUrl={featuredItem.imageUrl}
                        fallbackClassName={featuredItem.fallbackClassName}
                        title={featuredItem.title}
                        description={featuredItem.description}
                      />
                    </div>

                    {/* Standard Cards */}
                    {standardItems.map((item, itemIndex) => (
                      <div
                        key={item.id}
                        className="h-[310px] flex-[0_0_31%] md:h-[330px]"
                      >
                        <StandardEventCard
                          id={item.id}
                          imageUrl={item.imageUrl}
                          fallbackClassName={item.fallbackClassName}
                          isPeek={itemIndex === 2}
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
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(to_left,#fafafa_0%,rgba(250,250,250,0.82)_34%,rgba(250,250,250,0.36)_68%,rgba(250,250,250,0)_100%)] opacity-80" />
        )}
        {totalPages > 1 && currentPage > 0 && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-[linear-gradient(to_right,#fafafa_0%,rgba(250,250,250,0.68)_42%,rgba(250,250,250,0.22)_74%,rgba(250,250,250,0)_100%)] opacity-70" />
        )}

        {/* Floating Right Arrow Button */}
        {totalPages > 1 && (
          <button
            onClick={handleNextPage}
            className="absolute right-3 z-20 w-8 h-8 rounded-full bg-white/95 shadow-card border border-card-border-subtle flex items-center justify-center text-slate-700 hover:text-brand-primary transition-all hover:scale-105 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4 stroke-[3px]" />
          </button>
        )}

        {/* Floating Left Arrow Button (Only show if not on page 0) */}
        {totalPages > 1 && currentPage > 0 && (
          <button
            onClick={handlePrevPage}
            className="absolute left-3 z-20 w-8 h-8 rounded-full bg-white/95 shadow-card border border-card-border-subtle flex items-center justify-center text-slate-700 hover:text-brand-primary transition-all hover:scale-105 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
            aria-label="Previous page"
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
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
