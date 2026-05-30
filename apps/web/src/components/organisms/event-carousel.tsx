import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import type { ArticleDetailResponse, ArticleListItem } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";

type EventCardStatus = "ongoing" | "completed";

interface EventCardItem {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  title: string;
  description?: string;
  date: string;
  status: EventCardStatus;
  tags?: string[];
  badge?: string;
}

interface FeaturedCardProps {
  id: string;
  imageUrl: string | null;
  fallbackClassName: string;
  title: string;
  description?: string;
  date: string;
  tags: string[];
}

function FeaturedEventCard({
  id,
  imageUrl,
  fallbackClassName,
  title,
  description,
  date,
  tags,
}: FeaturedCardProps) {
  const isMock = id.startsWith("mock-");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const cardContent = (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 select-none group flex flex-col justify-end">
      <div className={`absolute inset-0 ${fallbackClassName}`} />
      {showImage && (
        <img
          src={imageUrl ?? undefined}
          alt=""
          aria-hidden="true"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
        />
      )}
      {/* Dark overlay for readability */}
      <div
        className={
          showImage
            ? "absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20"
            : "absolute inset-0 bg-black/15"
        }
      />

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col">
        {/* Pills & Date Row */}
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full select-none ${
                  tag === "진행중"
                    ? "bg-[#0c3e19] text-[#5cdb7d]"
                    : tag.startsWith("D-")
                      ? "bg-[#74b816] text-white font-extrabold"
                      : "bg-[#1098ad] text-white"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium text-stone-300 tracking-tight select-none">
            {date}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base lg:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-[#5cdb7d] transition-colors line-clamp-1">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="mt-1.5 text-xs text-stone-300 line-clamp-2 leading-relaxed font-normal">
            {description}
          </p>
        )}
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
  title: string;
  description?: string;
  date: string;
  status: EventCardStatus;
  badge?: string;
}

function StandardEventCard({
  id,
  imageUrl,
  fallbackClassName,
  title,
  description,
  date,
  status,
  badge,
}: StandardCardProps) {
  const isMock = id.startsWith("mock-");
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const cardContent = (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 select-none group flex flex-col justify-end">
      <div className={`absolute inset-0 ${fallbackClassName}`} />
      {showImage && (
        <img
          src={imageUrl ?? undefined}
          alt=""
          aria-hidden="true"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
        />
      )}
      {/* Dark overlay for readability */}
      <div
        className={
          showImage
            ? "absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20"
            : "absolute inset-0 bg-black/15"
        }
      />

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex flex-col">
        {/* Title */}
        <h3 className="text-[13.5px] font-bold text-white leading-snug tracking-tight group-hover:text-[#5cdb7d] transition-colors line-clamp-1">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="mt-1 text-xs text-stone-300 line-clamp-1 leading-normal font-normal">
            {description}
          </p>
        )}

        {/* Status & Date Footer Row */}
        <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <span className="bg-[#1c7ed6] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm select-none">
                {badge}
              </span>
            )}
            <div className="rounded-full bg-[#0c3e19] text-[#5cdb7d] px-2.5 py-0.5 text-[9.5px] font-bold tracking-tight select-none">
              {status === "ongoing" ? "진행중" : "완료"}
            </div>
          </div>
          <span className="text-[10px] font-semibold tracking-tight text-stone-400 select-none">
            {date}
          </span>
        </div>
      </div>
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

function formatDate(dateIso: string) {
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
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

export function EventCarousel() {
  const [currentPage, setCurrentPage] = useState(0);
  const [events, setEvents] = useState<EventCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      const resolveStatus = (
        item: ArticleListItem,
        detail?: ArticleDetailResponse,
      ): EventCardStatus => {
        if (detail?.survey) {
          return detail.survey.computedState === "open"
            ? "ongoing"
            : "completed";
        }
        const isRecent =
          isoToMs(item.postedAt) > nowMs() - 14 * 24 * 60 * 60 * 1000;
        return isRecent ? "ongoing" : "completed";
      };

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
                date: formatDate(item.postedAt),
                imageUrl: resolveEventImageUrl(detail),
                fallbackClassName: resolveFallbackClassName(item.articleId),
                status: resolveStatus(item, detail),
              };
            } catch {
              return {
                id: item.articleId,
                title: item.titleKo,
                description: item.eventDescription ?? item.titleKo,
                date: formatDate(item.postedAt),
                imageUrl: null,
                fallbackClassName: resolveFallbackClassName(item.articleId),
                status: resolveStatus(item),
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

  // Chunk events into pages of 4 items (1 featured + 3 standard = 4 items)
  const chunkedPages = useMemo(() => {
    const pages: EventCardItem[][] = [];
    for (let i = 0; i < displayEvents.length; i += 4) {
      const chunk = displayEvents.slice(i, i + 4);
      if (chunk.length > 0) {
        pages.push(chunk);
      }
    }
    return pages;
  }, [displayEvents]);

  const totalPages = chunkedPages.length;

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  if (loading && events.length === 0) {
    return (
      <section className="h-full bg-kaist-white overflow-hidden flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kaist-darkgreen"></div>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="h-full bg-transparent flex flex-col items-center justify-center min-h-[150px] border border-dashed border-slate-200 rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.025)]">
        <p className="text-sm font-semibold text-slate-400">
          진행 중인 행사가 없습니다.
        </p>
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
          className="text-[10px] font-bold text-kaist-grey hover:text-kaist-darkgreen transition-colors cursor-pointer flex items-center gap-0.5"
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

      <div className="relative flex items-center justify-center">
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

              return (
                <div
                  key={pageIdx}
                  className="w-full flex-shrink-0 grid grid-cols-1 md:grid-cols-5 gap-5"
                >
                  {/* Featured Card (spans 2 columns) */}
                  <div className="md:col-span-2 h-[290px] md:h-[315px]">
                    <FeaturedEventCard
                      id={featuredItem.id}
                      imageUrl={featuredItem.imageUrl}
                      fallbackClassName={featuredItem.fallbackClassName}
                      title={featuredItem.title}
                      description={featuredItem.description}
                      date={featuredItem.date}
                      tags={
                        featuredItem.tags || [
                          "학부",
                          featuredItem.status === "ongoing" ? "진행중" : "완료",
                        ]
                      }
                    />
                  </div>

                  {/* Standard Cards (span 1 column each) */}
                  {standardItems.map((item) => (
                    <div
                      key={item.id}
                      className="md:col-span-1 h-[290px] md:h-[315px]"
                    >
                      <StandardEventCard
                        id={item.id}
                        imageUrl={item.imageUrl}
                        fallbackClassName={item.fallbackClassName}
                        title={item.title}
                        description={item.description}
                        date={item.date}
                        status={item.status}
                        badge={item.badge || "KAIST SoC"}
                      />
                    </div>
                  ))}

                  {/* Padding if less than 4 items */}
                  {Array.from({ length: 4 - pageItems.length }).map(
                    (_, padIdx) => (
                      <div
                        key={`pad-${padIdx}`}
                        className="md:col-span-1 opacity-0 pointer-events-none"
                      />
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Right Arrow Button */}
        {totalPages > 1 && (
          <button
            onClick={handleNextPage}
            className="absolute right-4 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-slate-100/50 flex items-center justify-center text-slate-800 hover:text-[#137333] transition-all hover:scale-105 cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4 stroke-[3px]" />
          </button>
        )}

        {/* Floating Left Arrow Button (Only show if not on page 0) */}
        {totalPages > 1 && currentPage > 0 && (
          <button
            onClick={handlePrevPage}
            className="absolute left-4 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-slate-100/50 flex items-center justify-center text-slate-800 hover:text-[#137333] transition-all hover:scale-105 cursor-pointer"
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
