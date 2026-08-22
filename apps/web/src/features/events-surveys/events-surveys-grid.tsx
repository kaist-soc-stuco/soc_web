import { CalendarDays, Clock, ShieldCheck } from "lucide-react";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import { Link } from "react-router-dom";

import {
  getCardPeriodText,
  isClosedItem,
  type UnifiedItem,
} from "@/lib/events-surveys";

interface EventsSurveysGridProps {
  items: UnifiedItem[];
  lang: string;
}

const getItemHref = (item: UnifiedItem) => {
  if (item.kind === "EVENT") {
    return `/board/행사/${item.id}`;
  }
  return isClosedItem(item) && item.resultVisibility === "PUBLIC"
    ? `/survey/${item.id}/results`
    : `/survey/${item.id}`;
};

const getStatusBadge = (item: UnifiedItem, lang: string) => {
  if (item.computedState === "before_open") {
    return {
      label: lang === "ko" ? "시작 전" : "Upcoming",
      color: "bg-amber-50 text-amber-800",
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
        dDayText = "D-Day";
      } else {
        dDayText = lang === "ko" ? "마감" : "Closed";
      }
    }
    return {
      label: dDayText || (lang === "ko" ? "진행 중" : "Ongoing"),
      color: "bg-brand-primary-light text-brand-primary",
    };
  }
  return {
    label: lang === "ko" ? "마감" : "Closed",
    color: "bg-slate-100 text-slate-600",
  };
};

const getRestrictionMeta = (item: UnifiedItem, lang: string) => {
  const meta: string[] = [];
  if (item.feePayersOnly) {
    meta.push(lang === "ko" ? "과비 납부자" : "Paid members only");
  } else if (item.visibilityScope === "STAFF_ONLY") {
    meta.push(lang === "ko" ? "운영진 전용" : "Staff only");
  } else if (item.kind !== "EVENT" || item.visibilityScope === "MEMBERS") {
    meta.push(lang === "ko" ? "로그인 회원" : "Signed-in members");
  } else {
    meta.push(lang === "ko" ? "누구나" : "Everyone");
  }
  if (item.isKoreanOnly) {
    meta.push(lang === "ko" ? "한국어 콘텐츠" : "Korean content only");
  }
  return meta.join(" · ");
};

export function EventsSurveysGrid({
  items,
  lang,
}: EventsSurveysGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
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
        const restrictionMeta = getRestrictionMeta(item, lang);
        const href = getItemHref(item);

        return (
          <div
            key={item.id}
            className={`interaction-card group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-card ${
              closed ? "border-slate-200 opacity-75" : "border-gray-200"
            }`}
          >
            <Link
              aria-label={title}
              to={href}
              className="flex h-full min-h-0 flex-1 flex-col"
            >
                    {item.kind === "EVENT" && (
                      <div className="relative flex aspect-video items-center justify-center overflow-hidden border-b border-slate-100 bg-white">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <CalendarDays
                            aria-hidden="true"
                            className="h-8 w-8 text-slate-400"
                          />
                        )}
                      </div>
                    )}

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        {item.kind === "EVENT" && item.surveyId && !closed && (
                          <span className="inline-flex h-6 items-center rounded-md bg-sky-50 px-2 text-[11px] font-semibold text-sky-700">
                            {lang === "ko" ? "신청 가능" : "Application open"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-app-text-strong">
                          {title}
                        </h3>
                        {desc ? (
                          <p className="line-clamp-2 text-[13px] font-normal leading-snug text-app-text-body">
                            {desc}
                          </p>
                        ) : null}
                      </div>
                    </div>

              <div className="mt-auto space-y-2.5 px-4 pb-4 pt-0">
                {hasCapacity && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-normal text-slate-600">
                      <span>{lang === "ko" ? "신청 현황" : "Registration Status"}</span>
                      <span>
                        {currentResponses} / {item.maxResponses} ({Math.round(fillPercentage)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-100">
                      <div
                        className="h-full bg-brand-primary transition-[width] duration-300"
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[12px] font-normal text-slate-700">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        <span className="truncate">{getCardPeriodText(item, lang)}</span>
                </div>
                {restrictionMeta ? (
                  <div className="flex items-center gap-1.5 text-[12px] font-normal text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{restrictionMeta}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
