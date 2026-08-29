import type {
  EventsSurveysStateFilter,
} from "@/lib/events-surveys";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageSearchField } from "@/components/ui/page-layout";

const stateFilters: Array<{
  value: EventsSurveysStateFilter;
  labelKo: string;
  labelEn: string;
}> = [
  { value: "all", labelKo: "전체", labelEn: "All" },
  { value: "before_open", labelKo: "시작 예정", labelEn: "Upcoming" },
  { value: "open", labelKo: "진행 중", labelEn: "Ongoing" },
  { value: "closed", labelKo: "마감", labelEn: "Closed" },
];

interface EventsSurveysFilterBarProps {
  lang: string;
  onQueryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStateFilterChange: (filter: EventsSurveysStateFilter) => void;
  dateFrom: string;
  dateTo: string;
  query: string;
  stateCounts: Record<EventsSurveysStateFilter, number>;
  stateFilter: EventsSurveysStateFilter;
}

export function EventsSurveysFilterBar({
  lang,
  onQueryChange,
  onDateFromChange,
  onDateToChange,
  onStateFilterChange,
  dateFrom,
  dateTo,
  query,
  stateCounts,
  stateFilter,
}: EventsSurveysFilterBarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 max-w-full overflow-x-auto">
        <SegmentedControl
          ariaLabel={lang === "ko" ? "행사 상태" : "Event status"}
          className="clean-segmented-control"
          options={stateFilters.map((filter) => ({
            value: filter.value,
            label: (
              <span className="inline-flex items-center gap-1">
                <span>{lang === "ko" ? filter.labelKo : filter.labelEn}</span>
                <span className="tabular-nums text-[length:var(--ui-text-caption-size)] text-slate-400">
                  {stateCounts[filter.value]}
                </span>
              </span>
            ),
          }))}
          value={stateFilter}
          onChange={onStateFilterChange}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2 text-xs font-normal text-slate-500">
          <span>{lang === "ko" ? "시작" : "From"}</span>
          <input
            aria-label={lang === "ko" ? "검색 시작일" : "Search start date"}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.currentTarget.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-normal text-slate-500">
          <span>{lang === "ko" ? "종료" : "To"}</span>
          <input
            aria-label={lang === "ko" ? "검색 종료일" : "Search end date"}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.currentTarget.value)}
          />
        </label>
        <PageSearchField
          ariaLabel={lang === "ko" ? "행사·설문 검색" : "Search events and surveys"}
          className="order-last w-full sm:w-64 lg:w-72"
          onChange={onQueryChange}
          onClear={() => onQueryChange("")}
          placeholder={lang === "ko" ? "제목, 내용 검색" : "Search titles and content"}
          value={query}
        />
      </div>
    </div>
  );
}
