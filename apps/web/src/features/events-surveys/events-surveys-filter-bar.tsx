import { SelectDropdown } from "@/components/atoms/select-dropdown";
import type {
  EventsSurveysSortKey,
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

const sortOptions: Array<{
  value: EventsSurveysSortKey;
  labelKo: string;
  labelEn: string;
}> = [
  { value: "latest", labelKo: "최신순", labelEn: "Newest" },
  { value: "deadline", labelKo: "마감 임박순", labelEn: "Deadline" },
];

interface EventsSurveysFilterBarProps {
  isEventTab: boolean;
  lang: string;
  onSortByChange: (sortBy: EventsSurveysSortKey) => void;
  onQueryChange: (value: string) => void;
  onStateFilterChange: (filter: EventsSurveysStateFilter) => void;
  query: string;
  sortBy: EventsSurveysSortKey;
  stateCounts: Record<EventsSurveysStateFilter, number>;
  stateFilter: EventsSurveysStateFilter;
}

export function EventsSurveysFilterBar({
  isEventTab,
  lang,
  onSortByChange,
  onQueryChange,
  onStateFilterChange,
  query,
  sortBy,
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
                <span className="tabular-nums text-[11px] text-slate-400">
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
        {!isEventTab ? (
          <SelectDropdown
            value={sortBy}
            options={sortOptions.map((option) => ({
              value: option.value,
              label: lang === "ko" ? option.labelKo : option.labelEn,
            }))}
            onChange={(value) => onSortByChange(value as EventsSurveysSortKey)}
            className="w-40"
            buttonClassName="h-[var(--ui-control-height)] rounded-[var(--ui-control-radius)] border-slate-200 px-3 py-0 text-sm font-medium text-slate-700 shadow-none"
            menuClassName="rounded-lg border-slate-200 shadow-elevated"
            optionClassName="text-sm"
            emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
          />
        ) : null}

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
