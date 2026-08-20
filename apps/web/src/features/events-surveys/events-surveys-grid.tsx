import { ArrowRight, CalendarDays, Clock, ShieldCheck } from "lucide-react";
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
  const stateOrder: UnifiedItem["computedState"][] = [
    "before_open",
    "open",
    "closed",
  ];
  const groups = stateOrder
    .map((state) => ({
      state,
      items: items.filter((item) => item.computedState === state),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.state} aria-labelledby={`events-surveys-${group.state}`}>
          <div className="mb-3 flex items-center gap-2">
            <h2
              id={`events-surveys-${group.state}`}
              className="text-base font-semibold text-app-text-strong"
            >
              {getSectionLabel(group.state, lang)}
            </h2>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-app-text-muted">
              {group.items.length}
            </span>
          </div>

          <div
            className={`grid grid-cols-1 gap-4 ${
              group.items.length === 1
                ? ""
                : group.items.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            {group.items.map((item) => {
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
              const actionLabel = getActionLabel(item, lang);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(href)}
                  className={`group flex w-full cursor-pointer flex-col justify-between overflow-hidden rounded-lg border bg-white text-left shadow-card transition-colors hover:border-brand-primary-border ${
                    closed ? "border-slate-200 opacity-75 hover:opacity-100" : "border-gray-200"
                  }`}
                >
                  {item.kind === "EVENT" && (
                    <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <CalendarDays
                          aria-hidden="true"
                          className="h-8 w-8 text-slate-400"
                        />
                      )}
                    </div>
                  )}

                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      {item.kind === "EVENT" && item.surveyId && !closed && (
                        <span className="inline-flex items-center rounded-md border border-brand-primary-border bg-brand-primary-light px-2 py-1 text-[11px] font-semibold text-brand-primary">
                          {lang === "ko" ? "신청 가능" : "Application open"}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-app-text-strong">
                        {title}
                      </h3>
                      {desc ? (
                        <p className="line-clamp-2 text-[13px] font-normal leading-snug text-app-text-body">
                          {desc}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-slate-100 p-4 pt-3">
                    {hasCapacity && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium text-app-text-muted">
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

                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-app-text-muted">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
                      <span className="truncate">{getCardPeriodText(item, lang)}</span>
                    </div>
                    {restrictionMeta ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-app-text-muted">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{restrictionMeta}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-end pt-1 text-[12px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-brand-primary">
                        {actionLabel ? <span>{actionLabel}</span> : null}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
