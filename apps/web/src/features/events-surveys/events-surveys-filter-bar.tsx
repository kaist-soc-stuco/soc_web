import { SelectDropdown } from "@/components/atoms/select-dropdown";
import type {
  EventsSurveysSortKey,
  EventsSurveysStateFilter,
} from "@/lib/events-surveys";

const stateFilters: Array<{
  value: EventsSurveysStateFilter;
  labelKo: string;
  labelEn: string;
}> = [
  { value: "all", labelKo: "전체", labelEn: "All" },
  { value: "before_open", labelKo: "시작 전", labelEn: "Upcoming" },
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
  lang: string;
  onSortByChange: (sortBy: EventsSurveysSortKey) => void;
  onStateFilterChange: (filter: EventsSurveysStateFilter) => void;
  sortBy: EventsSurveysSortKey;
  stateFilter: EventsSurveysStateFilter;
  visibleCount: number;
}

export function EventsSurveysFilterBar({
  lang,
  onSortByChange,
  onStateFilterChange,
  sortBy,
  stateFilter,
  visibleCount,
}: EventsSurveysFilterBarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 max-w-full overflow-x-auto">
        <div className="inline-flex min-w-max rounded-md border border-slate-200 bg-slate-50 p-0.5">
        {stateFilters.map((filter) => {
          const active = stateFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onStateFilterChange(filter.value)}
              className={`min-h-9 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                active
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-brand-primary"
              }`}
            >
              {lang === "ko" ? filter.labelKo : filter.labelEn}
            </button>
          );
        })}
        </div>
      </div>

      <div className="text-xs font-medium text-app-text-muted" aria-live="polite">
        {lang === "ko" ? (
          <span>
            전체 <strong className="text-brand-primary">{visibleCount}</strong>
            개
          </span>
        ) : (
          <span>
            <strong className="text-brand-primary">{visibleCount}</strong> items
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="hidden">
          <input
            type="checkbox"
            checked={stateFilter === "open"}
            onChange={(event) =>
              onStateFilterChange(event.target.checked ? "open" : "all")
            }
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
          />
          <span>{lang === "ko" ? "진행 중인 항목만 보기" : "Ongoing only"}</span>
        </label>

        <SelectDropdown
          value={sortBy}
          options={sortOptions.map((option) => ({
            value: option.value,
            label: lang === "ko" ? option.labelKo : option.labelEn,
          }))}
          onChange={(value) => onSortByChange(value as EventsSurveysSortKey)}
          className="w-40"
          buttonClassName="h-10 rounded-md border-slate-200 px-3 py-0 text-[13px] font-semibold text-slate-700 shadow-none focus:ring-brand-primary/20"
          menuClassName="rounded-lg border-slate-200 shadow-elevated"
          optionClassName="text-[12px]"
          emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
        />
      </div>
    </div>
  );
}
