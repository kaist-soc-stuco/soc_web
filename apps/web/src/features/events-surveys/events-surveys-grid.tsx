import { Fragment } from "react";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { isoToDate, localDate, nowDate } from "@soc/shared";

import {
  getCardPeriodText,
  isClosedItem,
  isOpenItem,
  type UnifiedItem,
} from "@/lib/events-surveys";

interface EventsSurveysGridProps {
  items: UnifiedItem[];
  lang: string;
  onNavigate: (href: string) => void;
}

const getItemHref = (item: UnifiedItem) => {
  if (item.kind === "EVENT") {
    return `/board/행사/${item.id}`;
  }
  return isClosedItem(item) && item.resultVisibility === "PUBLIC"
    ? `/survey/${item.id}/results`
    : `/survey/${item.id}`;
};

const EVENT_PLACEHOLDER_CLASS_NAMES = [
  "bg-[#123524]",
  "bg-[#173f5f]",
  "bg-[#24415f]",
  "bg-[#2b3a2f]",
] as const;

function resolveEventPlaceholderClassName(id: string) {
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return EVENT_PLACEHOLDER_CLASS_NAMES[hash % EVENT_PLACEHOLDER_CLASS_NAMES.length];
}

const getStatusBadge = (item: UnifiedItem, lang: string) => {
  if (item.computedState === "before_open") {
    return {
      label: lang === "ko" ? "시작 전" : "Upcoming",
      color: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (item.computedState === "open") {
    let dDayText = "";
    if (item.closesAt) {
      const now = nowDate();
      const closeDate = isoToDate(item.closesAt);
      const d1 = localDate(now.getFullYear(), now.getMonth(), now.getDate());
      const d2 = localDate(
        closeDate.getFullYear(),
        closeDate.getMonth(),
        closeDate.getDate(),
      );
      const diffMs = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        dDayText = `D-${diffDays}`;
      } else if (diffDays === 0) {
        dDayText = lang === "ko" ? "오늘 마감" : "D-Day";
      } else {
        dDayText = lang === "ko" ? "마감" : "Closed";
      }
    }
    return {
      label: dDayText
        ? `${lang === "ko" ? "진행중" : "Ongoing"} (${dDayText})`
        : lang === "ko"
          ? "진행중"
          : "Ongoing",
      color: "bg-brand-primary-light text-brand-primary border-brand-primary-border",
    };
  }
  return {
    label: lang === "ko" ? "마감" : "Closed",
    color: "bg-gray-100 text-gray-600 border-gray-200",
  };
};

const getActionLabel = (item: UnifiedItem, lang: string) => {
  if (item.kind === "EVENT") {
    return lang === "ko" ? "자세히 보기" : "View details";
  }
  if (isOpenItem(item) || item.computedState === "before_open") {
    return lang === "ko" ? "참여하기" : "Participate";
  }
  if (item.resultVisibility === "PUBLIC") {
    return lang === "ko" ? "결과 보기" : "View results";
  }
  return "";
};

const getRestrictionMeta = (item: UnifiedItem, lang: string) => {
  const meta: string[] = [];
  if (item.feePayersOnly) {
    meta.push(lang === "ko" ? "과비 납부자" : "Paid members only");
  }
  if (item.isKoreanOnly) {
    meta.push(lang === "ko" ? "한국어 사용자" : "Korean speakers only");
  }
  if (meta.length === 0) {
    return lang === "ko" ? "누구나" : "Everyone";
  }
  return meta.join(" · ");
};

const getSectionLabel = (state: UnifiedItem["computedState"], lang: string) => {
  if (state === "before_open") return lang === "ko" ? "시작 전" : "Upcoming";
  if (state === "open") return lang === "ko" ? "진행 중" : "Ongoing";
  return lang === "ko" ? "마감" : "Closed";
};

export function EventsSurveysGrid({
  items,
  lang,
  onNavigate,
}: EventsSurveysGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {items.map((item, index) => {
        const statusInfo = getStatusBadge(item, lang);
        const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
        const desc =
          lang === "ko"
            ? item.descriptionKo
            : item.descriptionEn || item.descriptionKo;

        const hasCapacity = item.maxResponses && item.maxResponses > 0;
        const currentResponses = item.responseCount ?? 0;
        const fillPercentage = hasCapacity
          ? Math.min(100, (currentResponses / (item.maxResponses || 1)) * 100)
          : 0;
        const closed = isClosedItem(item);
        const previousItem = items[index - 1];
        const startsStateSection =
          index === 0 || previousItem?.computedState !== item.computedState;
        const sectionCount = items.filter(
          (entry) => entry.computedState === item.computedState,
        ).length;
        const restrictionMeta = getRestrictionMeta(item, lang);
        const descriptionText =
          desc ||
          (lang === "ko"
            ? "등록된 상세 설명이 없습니다."
            : "No description provided.");
        const href = getItemHref(item);
        const actionLabel = getActionLabel(item, lang);

        return (
          <Fragment key={item.id}>
            {startsStateSection ? (
              <div className="col-span-full pt-1">
                <h2 className="text-base font-extrabold text-slate-900">
                  {getSectionLabel(item.computedState, lang)}{" "}
                  <span className="text-xs font-bold text-slate-400">
                    ({sectionCount})
                  </span>
                </h2>
              </div>
            ) : null}
            <div
              role="link"
              tabIndex={0}
              onClick={() => onNavigate(href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onNavigate(href);
                }
              }}
              className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-primary-border hover:shadow-card-hover ${
                closed
                  ? "border-slate-200 opacity-75 hover:opacity-95"
                  : "border-gray-200"
              }`}
            >
              {item.kind === "EVENT" && (
                <div className="relative h-36 overflow-hidden">
                  <div
                    className={`absolute inset-0 ${resolveEventPlaceholderClassName(item.id)}`}
                  />
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                </div>
              )}

              <div className="space-y-3 p-3.5">
                <div className="flex flex-wrap items-center justify-start gap-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                  {item.kind === "EVENT" && item.surveyId && !closed && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-brand-primary-light text-brand-primary border border-brand-primary/10">
                      {lang === "ko" ? "신청 가능" : "Application open"}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-[1.05rem] font-extrabold text-kaist-black line-clamp-2 leading-snug">
                    {title}
                  </h3>
                  <p
                    className={`min-h-[2.25rem] text-[13px] line-clamp-2 leading-snug font-normal ${
                      desc ? "text-kaist-grey/90" : "text-kaist-grey/55"
                    }`}
                  >
                    {descriptionText}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 p-3.5 pt-3">
                {hasCapacity && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-kaist-grey/90">
                      <span>
                        {lang === "ko" ? "신청 현황" : "Registration Status"}
                      </span>
                      <span>
                        {currentResponses} / {item.maxResponses} (
                        {Math.round(fillPercentage)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-primary/80 h-full rounded-full transition-all duration-300"
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-kaist-grey/85">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen/80" />
                  <span className="truncate">{getCardPeriodText(item, lang)}</span>
                </div>
                <div
                  className={`flex min-h-[0.875rem] items-center gap-1.5 text-[11px] font-bold ${
                    restrictionMeta ? "text-kaist-grey/75" : "text-transparent"
                  }`}
                  aria-hidden={!restrictionMeta}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen/80" />
                  <span className="truncate">{restrictionMeta || "-"}</span>
                </div>
                <div className="flex justify-end items-center pt-1 text-[12px] font-extrabold">
                  <span className="inline-flex items-center gap-1 text-brand-primary">
                    {actionLabel && (
                      <span className="cta-underline">{actionLabel}</span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
