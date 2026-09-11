import type {
  ArticleEngagementKind,
} from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import { ClipboardList, Clock, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ArticleEngagementActions } from "@/components/ui/article-engagement-actions";
import { stripRichText } from "@/components/ui/rich-text-content";
import {
  getCardPeriodText,
  isClosedItem,
  type UnifiedItem,
} from "@/lib/events-surveys";
import { resolveAssetUrl } from "@/lib/asset-url";
import { EventCardFallback } from "@/components/organisms/event-card-fallback";

interface EventsSurveysGridProps {
  isAuthenticated: boolean;
  items: UnifiedItem[];
  lang: string;
  engagementSubmitting?: string | null;
  onEngagementToggle?: (
    item: UnifiedItem,
    kind: ArticleEngagementKind,
    active: boolean,
  ) => void;
}

const getItemHref = (item: UnifiedItem) => {
  if (item.kind === "EVENT") {
    return `/events/${item.id}`;
  }
  return isClosedItem(item) && item.resultVisibility === "PUBLIC"
    ? `/survey/${item.id}/results`
    : `/survey/${item.id}`;
};

function getDayDifference(value: string | null, now = nowDate()) {
  if (!value) return null;
  const target = isoToDate(value);
  if (Number.isNaN(target.getTime())) return null;

  const today = localDate(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = localDate(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  return Math.ceil(
    (targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getStatusText(item: UnifiedItem, lang: string) {
  const target =
    item.computedState === "before_open" ? item.opensAt : item.closesAt;
  const dayDifference = getDayDifference(target);

  if (item.computedState === "before_open") {
    if (dayDifference !== null && dayDifference > 0) {
      return `D-${dayDifference}`;
    }
    if (dayDifference === 0) return "D-Day";
    return lang === "ko" ? "시작 예정" : "Upcoming";
  }

  if (item.computedState === "closed") {
    return lang === "ko" ? "마감" : "Closed";
  }

  return lang === "ko" ? "진행 중" : "Ongoing";
}

interface CardBadge {
  label: string;
  className: string;
}

const DEFAULT_CARD_BADGE_CLASS =
  "border-white/30 bg-slate-950/35 text-white";
const OPEN_CARD_BADGE_CLASS =
  "border-brand-primary/70 bg-brand-primary/90 text-white";

function getCardBadges(item: UnifiedItem, lang: string): CardBadge[] {
  const statusBadge: CardBadge = {
    label: getStatusText(item, lang),
    className:
      item.computedState === "open"
        ? OPEN_CARD_BADGE_CLASS
        : DEFAULT_CARD_BADGE_CLASS,
  };
  const badges: CardBadge[] = [
    statusBadge,
    {
      label: getApplicationText(item, lang) ?? "",
      className: DEFAULT_CARD_BADGE_CLASS,
    },
    {
      label: getAudienceText(item, lang),
      className: DEFAULT_CARD_BADGE_CLASS,
    },
  ];

  return badges
    .filter((badge) => badge.label)
    .filter(
      (badge, index, allBadges) =>
        allBadges.findIndex((candidate) => candidate.label === badge.label) ===
        index,
    );
}

function isApplicationFull(item: UnifiedItem) {
  return Boolean(
    item.linkedSurveyMaxResponses &&
      item.linkedSurveyMaxResponses > 0 &&
      (item.linkedSurveyResponseCount ?? 0) >= item.linkedSurveyMaxResponses,
  );
}

function getApplicationText(item: UnifiedItem, lang: string) {
  if (item.kind !== "EVENT" || !item.surveyId || isClosedItem(item)) {
    return null;
  }
  if (isApplicationFull(item)) {
    return lang === "ko" ? "신청 마감" : "Applications closed";
  }
  if (item.linkedSurveyState === "closed") {
    return lang === "ko" ? "신청 마감" : "Applications closed";
  }
  if (item.linkedSurveyState === "open") {
    return item.computedState === "before_open"
      ? lang === "ko"
        ? "사전 신청"
        : "Pre-registration"
      : lang === "ko"
        ? "신청중"
        : "Applications open";
  }
  if (item.linkedSurveyState === "before_open") {
    return lang === "ko" ? "신청 예정" : "Registration opens soon";
  }
  return null;
}

function getAudienceText(item: UnifiedItem, lang: string) {
  const audience =
    item.kind === "EVENT"
      ? item.linkedSurveyFeePayersOnly
        ? lang === "ko"
          ? "과비 납부자만"
          : "Fee-paying members only"
        : item.visibilityScope === "STAFF_ONLY"
          ? lang === "ko"
            ? "운영진 전용"
            : "Staff only"
          : item.visibilityScope === "MEMBERS"
            ? lang === "ko"
              ? "로그인 필요"
              : "Login required"
            : ""
      : item.feePayersOnly
        ? lang === "ko"
          ? "과비 납부자만"
          : "Fee-paying members only"
        : item.allowAnonymous
          ? lang === "ko"
            ? "로그인 없이 참여"
            : "No login required"
        : lang === "ko"
          ? "로그인 필요"
          : "Login required";

  const audienceText = audience
    ? item.kind !== "EVENT" && item.allowAnonymous
      ? audience
      : `🔒 ${audience}`
    : "";
  const languageText = item.isKoreanOnly
    ? lang === "ko"
      ? "한국어 전용"
      : "Korean only"
    : "";

  return [audienceText, languageText].filter(Boolean).join(" · ");
}

function CardMedia({
  imageUrl,
  isSurvey,
}: {
  imageUrl: string | null | undefined;
  isSurvey: boolean;
}) {
  const normalizedImageUrl = imageUrl?.trim() || null;
  const mediaUrl = normalizedImageUrl ? resolveAssetUrl(normalizedImageUrl) : null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [mediaUrl]);

  if (!mediaUrl || imageFailed) {
    if (!isSurvey) return <EventCardFallback />;
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        <ClipboardList
          aria-hidden="true"
          className="h-8 w-8 text-emerald-600/60"
        />
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt=""
      aria-hidden="true"
      onError={() => setImageFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
    />
  );
}

export function EventsSurveysGrid({
  isAuthenticated,
  items,
  lang,
  engagementSubmitting,
  onEngagementToggle,
}: EventsSurveysGridProps) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const title = stripRichText(lang === "ko" ? item.titleKo : item.titleEn || item.titleKo);
        const desc = stripRichText(
          lang === "ko"
            ? item.descriptionKo
            : item.descriptionEn || item.descriptionKo,
        );
        const closed = isClosedItem(item);
        const href = getItemHref(item);
        const isSurvey = item.kind !== "EVENT";
        const isHomeEventCard = item.kind === "EVENT";
        const period = getCardPeriodText(item, lang);
        const location = item.location?.trim() || null;
        const badges = getCardBadges(item, lang);
        const canEngage = item.kind === "EVENT" && onEngagementToggle;
        const submitting =
          engagementSubmitting === `${item.id}:SCRAP` ? "SCRAP" : null;

        return (
          <div
            key={item.id}
            className={
              isHomeEventCard
                ? `home-portal-event-card select-none group ${closed ? "opacity-50" : ""}`
                : `interaction-card select-none group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-card transition-[transform,box-shadow,opacity] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-elevated ${closed ? "border-slate-200 opacity-50" : "border-gray-200"}`
            }
          >
            <div
              className={
                isHomeEventCard
                  ? "home-portal-event-media"
                  : "relative aspect-video shrink-0 overflow-hidden border-b border-slate-100 bg-slate-50"
              }
            >
              <Link
                aria-label={title}
                to={href}
                className="absolute inset-0 block"
              >
                <CardMedia imageUrl={item.imageUrl} isSurvey={isSurvey} />
              </Link>
              {badges.length > 0 ? (
                <div
                  className={`pointer-events-none absolute z-10 flex flex-wrap gap-1.5 ${isHomeEventCard ? "left-4 top-4 max-w-[calc(100%-2rem)]" : "left-3 top-3 max-w-[calc(100%-4.5rem)]"}`}
                >
                  {badges.map((badge) => (
                    <span
                      key={badge.label}
                      className={`rounded-full border px-2.5 py-1 text-[length:var(--ui-text-caption-size)] font-medium leading-none shadow-sm backdrop-blur-md ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {canEngage ? (
                <div className="absolute right-3 top-3 z-20 rounded-lg border border-white/40 bg-white/75 p-0.5 shadow-sm backdrop-blur-md">
                  <ArticleEngagementActions
                    allowLike={false}
                    compact
                    isAuthenticated={isAuthenticated}
                    lang={lang}
                    likeCount={item.likeCount ?? 0}
                    scrapCount={item.scrapCount ?? 0}
                    scrapIconOnly
                    submitting={submitting}
                    viewerHasLiked={item.viewerHasLiked ?? false}
                    viewerHasScrapped={item.viewerHasScrapped ?? false}
                    onToggle={(kind, active) =>
                      onEngagementToggle(item, kind, active)
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="home-portal-event-body break-keep">
              <Link aria-label={title} to={href} className="min-w-0">
                <h3 className="line-clamp-2">{title}</h3>
                {desc ? <p className="line-clamp-2">{desc}</p> : null}
              </Link>
              <div className="home-portal-event-meta">
                {period ? (
                  <Link
                    aria-label={`${title} ${period}`}
                    to={href}
                    className="home-portal-event-time"
                  >
                    <Clock
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-slate-400"
                    />
                    <span className="truncate">{period}</span>
                  </Link>
                ) : null}
                {item.kind === "EVENT" ? (
                  <div className="home-portal-event-location flex min-w-0 items-center gap-1.5">
                    <MapPin
                      aria-hidden="true"
                      className={
                        location
                          ? "size-3.5 shrink-0 text-slate-400"
                          : "size-3.5 shrink-0 text-slate-300"
                      }
                    />
                    <span className="truncate text-slate-600">
                      {location ?? (lang === "ko" ? "장소 미정" : "Location TBD")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
