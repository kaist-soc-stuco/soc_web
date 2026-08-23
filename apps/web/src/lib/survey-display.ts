import type { SurveyRecord } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";

export type SurveyStatusTone =
  | "draft"
  | "closed"
  | "beforeOpen"
  | "open";

export interface SurveyStatusLike {
  computedState?: "before_open" | "open" | "closed" | string | null;
  isPublished?: boolean | null;
  lifecycleStatus?: "DRAFT" | "PUBLISHED" | string | null;
  closesAt?: string | null;
  opensAt?: string | null;
}

export interface SurveyStatusInfo {
  label: string;
  tone: SurveyStatusTone;
}

export type SurveyStatusFilter =
  | "all"
  | "draft"
  | "open"
  | "closed";
export type SurveyTypeFilter = "all" | string;
export type SurveyPeriodFilter = "all" | "7days" | "30days" | "1year";
export type SurveySortKey = "updatedAt" | "opensAt" | "responseCount";
export type SurveySortDirection = "asc" | "desc";

export interface SurveyListFilterOptions {
  periodFilter: SurveyPeriodFilter;
  searchQuery: string;
  sortBy: SurveySortKey;
  sortDirection?: SurveySortDirection;
  statusFilter: SurveyStatusFilter;
  typeFilter: SurveyTypeFilter;
}

export function getSurveyStatusInfo(
  survey: SurveyStatusLike,
  _showDday = true,
  _currentMs = nowMs(),
): SurveyStatusInfo {
  if (!survey.isPublished) {
    return { label: "임시저장", tone: "draft" };
  }

  if (survey.computedState === "closed") {
    return { label: "마감", tone: "closed" };
  }

  if (survey.computedState === "before_open") {
    return { label: "시작 예정", tone: "beforeOpen" };
  }

  if (survey.computedState === "open") {
    return { label: "진행중", tone: "open" };
  }

  const openMs = survey.opensAt ? isoToMs(survey.opensAt) : null;
  const closeMs = survey.closesAt ? isoToMs(survey.closesAt) : null;

  if (closeMs !== null && !Number.isNaN(closeMs) && closeMs <= _currentMs) {
    return { label: "마감", tone: "closed" };
  }

  if (openMs !== null && !Number.isNaN(openMs) && openMs > _currentMs) {
    return { label: "시작 예정", tone: "beforeOpen" };
  }

  return { label: "진행중", tone: "open" };
}

export function filterAndSortSurveys(
  surveys: SurveyRecord[],
  options: SurveyListFilterOptions,
  currentMs = nowMs(),
): SurveyRecord[] {
  let result = [...surveys];
  const query = options.searchQuery.trim().toLowerCase();

  if (query.length > 0) {
    result = result.filter(
      (survey) =>
        survey.titleKo.toLowerCase().includes(query) ||
        Boolean(survey.titleEn?.toLowerCase().includes(query)) ||
        Boolean(survey.descriptionKo?.toLowerCase().includes(query)) ||
        Boolean(survey.descriptionEn?.toLowerCase().includes(query)),
    );
  }

  if (options.statusFilter !== "all") {
    result = result.filter((survey) => {
      if (options.statusFilter === "draft") {
        return !survey.isPublished;
      }
      if (options.statusFilter === "closed") {
        return survey.isPublished && survey.computedState === "closed";
      }
      if (options.statusFilter === "open") {
        return survey.isPublished && survey.computedState === "open";
      }
      return true;
    });
  }

  if (options.typeFilter !== "all") {
    result = result.filter((survey) => survey.kind === options.typeFilter);
  }

  if (options.periodFilter !== "all") {
    result = result.filter((survey) => {
      const createdMs = isoToMs(survey.createdAt);
      const diffDays = (currentMs - createdMs) / (1000 * 60 * 60 * 24);

      if (options.periodFilter === "7days") return diffDays <= 7;
      if (options.periodFilter === "30days") return diffDays <= 30;
      if (options.periodFilter === "1year") return diffDays <= 365;
      return true;
    });
  }

  result.sort((a, b) => {
    const direction = options.sortDirection === "asc" ? -1 : 1;
    let comparison = 0;
    const getSortableMs = (value: string | null | undefined) => {
      if (!value) return 0;
      const ms = isoToMs(value);
      return Number.isNaN(ms) ? 0 : ms;
    };

    if (options.sortBy === "updatedAt") {
      comparison = getSortableMs(b.updatedAt) - getSortableMs(a.updatedAt);
    } else if (options.sortBy === "opensAt") {
      comparison = getSortableMs(b.opensAt) - getSortableMs(a.opensAt);
    } else if (options.sortBy === "responseCount") {
      comparison = (b.responseCount ?? 0) - (a.responseCount ?? 0);
    }

    return comparison * direction;
  });

  return result;
}
