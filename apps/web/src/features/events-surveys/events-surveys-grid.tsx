import type { ArticleEngagementKind } from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import { CalendarDays, Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { ArticleEngagementActions } from "@/components/ui/article-engagement-actions";
import { stripRichText } from "@/components/ui/rich-text-content";
import {
  getCardPeriodText,
  isClosedItem,
  type UnifiedItem,
} from "@/lib/events-surveys";

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
        : lang === "ko"
          ? "로그인 필요"
          : "Login required";

  const audienceText = audience ? `🔒 ${audience}` : "";
  const languageText = item.isKoreanOnly
    ? lang === "ko"
      ? "한국어 사용자만"
      : "Korean Speakers Only"
    : "";

  return [audienceText, languageText].filter(Boolean).join(" · ");
}

export function EventsSurveysGrid({
  isAuthenticated,
  items,
  lang,
  engagementSubmitting,
  onEngagementToggle,
}: EventsSurveysGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
        const desc = stripRichText(
          lang === "ko"
            ? item.descriptionKo
            : item.descriptionEn || item.descriptionKo,
        );
        const closed = isClosedItem(item);
        const href = getItemHref(item);
        const eyebrow = [
          getStatusText(item, lang),
          getApplicationText(item, lang),
          getAudienceText(item, lang),
        ]
          .filter(Boolean)
          .join(" · ");
        const canEngage = item.kind === "EVENT" && onEngagementToggle;
        const submitting =
          engagementSubmitting === `${item.id}:SCRAP` ? "SCRAP" : null;

        return (
          <div
            key={item.id}
            className={`interaction-card group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-card transition-[transform,box-shadow,opacity] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-elevated ${closed ? "border-slate-200 opacity-50" : "border-gray-200"}`}
          >
            {item.kind === "EVENT" ? (
              <Link
                aria-label={title}
                to={href}
                className="relative block aspect-video overflow-hidden border-b border-slate-100 bg-slate-50"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <CalendarDays
                      aria-hidden="true"
                      className="h-8 w-8 text-slate-400"
                    />
                  </div>
                )}
              </Link>
            ) : null}

            <div className={`flex min-h-0 flex-1 flex-col ${item.kind === "SURVEY" ? "p-5" : "p-4"}`}>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <Link
                  aria-label={title}
                  to={href}
                  className="min-w-0 flex-1"
                >
                  {eyebrow ? (
                    <p className="truncate text-xs font-medium leading-5 text-slate-500">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h3 className={`${item.kind === "SURVEY" ? "mt-2.5" : "mt-1"} line-clamp-2 text-[length:var(--ui-text-section-size)] font-semibold leading-5 text-app-text-strong`}>
                    {title}
                  </h3>
                  {desc ? (
                    <p className={`${item.kind === "SURVEY" ? "mt-2.5" : "mt-1.5"} line-clamp-2 text-[length:var(--ui-text-body-sm-size)] font-normal leading-snug text-app-text-body`}>
                      {desc}
                    </p>
                  ) : null}
                </Link>

                {canEngage ? (
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
                ) : null}
              </div>

              <Link
                aria-label={`${title} ${getCardPeriodText(item, lang)}`}
                to={href}
                className={`mt-auto flex items-center gap-1.5 text-xs font-normal text-slate-700 ${item.kind === "SURVEY" ? "pt-5" : "pt-4"}`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="truncate">{getCardPeriodText(item, lang)}</span>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
