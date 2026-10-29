import { DateRangePicker } from "@/components/ui/date-range-picker";
import type {
  EventsSurveysStateFilter,
} from "@/lib/events-surveys";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageSearchField } from "@/components/ui/page-layout";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { MobileDateRangeFields, MobileFilterActions, MobileFilterButton } from "@/components/ui/mobile-filter-controls";

const stateFilters: Array<{
  value: EventsSurveysStateFilter;
  labelKo: string;
  labelEn: string;
}> = [
  { value: "all", labelKo: "전체", labelEn: "All" },
  { value: "active", labelKo: "예정·진행 중", labelEn: "Upcoming & ongoing" },
  { value: "closed", labelKo: "지난 행사", labelEn: "Past events" },
];

interface EventsSurveysFilterBarProps {
  isSurvey?: boolean;
  lang: string;
  onQueryChange: (value: string) => void;
  onDateRangeChange: (value: { from: string; to: string }) => void;
  onStateFilterChange: (filter: EventsSurveysStateFilter) => void;
  onFiltersChange: (value: { state: EventsSurveysStateFilter; from: string; to: string }) => void;
  dateFrom: string;
  dateTo: string;
  query: string;
  stateCounts: Record<EventsSurveysStateFilter, number>;
  stateFilter: EventsSurveysStateFilter;
}

export function EventsSurveysFilterBar({
  isSurvey = false,
  lang,
  onQueryChange,
  onDateRangeChange,
  onStateFilterChange,
  onFiltersChange,
  dateFrom,
  dateTo,
  query,
  stateCounts,
  stateFilter,
}: EventsSurveysFilterBarProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ state: stateFilter, from: dateFrom, to: dateTo });
  const filters = isSurvey ? [stateFilters[0], stateFilters[1], { value: "always" as const, labelKo: "상시", labelEn: "Always open" }, { ...stateFilters[2], labelKo: "종료된 설문", labelEn: "Ended surveys" }] : stateFilters;
  const options = filters.map(filter => ({ value: filter.value, label: <span className="inline-flex items-center gap-1"><span>{lang === "ko" ? filter.labelKo : filter.labelEn}</span><span className="tabular-nums text-[length:var(--ui-text-caption-size)] text-slate-400">{stateCounts[filter.value]}</span></span> }));
  if (isMobile) return <>
    <div className="mobile-filter-toolbar mb-5">
    <PageSearchField ariaLabel={lang === "ko" ? "행사·설문 검색" : "Search events and surveys"} className="!w-full min-w-0" value={query} onChange={onQueryChange} onClear={() => onQueryChange("")} placeholder={lang === "ko" ? "제목, 내용 검색" : "Search titles and content"} />
    <MobileFilterButton label={lang === "ko" ? "필터" : "Filter"} active={stateFilter !== "active" || Boolean(dateFrom || dateTo)} open={open} onClick={() => { setDraft({ state: stateFilter, from: dateFrom, to: dateTo }); setOpen(true); }} />
    <FilterSheet className="mobile-filter-sheet" title={lang === "ko" ? "필터" : "Filters"} open={open} onClose={() => setOpen(false)} footer={<MobileFilterActions lang={lang} onReset={() => setDraft({ state: "active", from: "", to: "" })} onApply={() => { onFiltersChange(draft); setOpen(false); }} />}>
      <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "상태" : "Status"}</legend>
        {filters.map(filter => <label className="mobile-filter-option" key={filter.value}><input type="radio" name="event-state" value={filter.value} checked={draft.state === filter.value} onChange={() => setDraft({ ...draft, state: filter.value })} /><span>{lang === "ko" ? filter.labelKo : filter.labelEn}</span><span className="ml-auto text-slate-400 tabular-nums">{stateCounts[filter.value]}</span></label>)}
      </fieldset>
      {draft.state !== "always" && <MobileDateRangeFields lang={lang} from={draft.from} to={draft.to} onChange={range => setDraft({ ...draft, ...range })} />}
    </FilterSheet>
  </div></>;
  return (
    <div className="mobile-events-filters mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 max-w-full overflow-x-auto">
        <SegmentedControl
          ariaLabel={lang === "ko" ? isSurvey ? "설문 상태" : "행사 상태" : isSurvey ? "Survey status" : "Event status"}
          className="clean-segmented-control"
          options={options}
          value={stateFilter}
          onChange={onStateFilterChange}
        />
      </div>

      <div className="mobile-events-search-row flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div className="hidden md:block">
        {stateFilter !== "always" &&
        <DateRangePicker lang={lang} presetType="future" value={{ from: dateFrom, to: dateTo }}
          onChange={onDateRangeChange} />}
        </div>
        <PageSearchField
          ariaLabel={lang === "ko" ? "행사·설문 검색" : "Search events and surveys"}
          className="min-w-0 basis-0 sm:w-64 lg:w-72"
          onChange={onQueryChange}
          onClear={() => onQueryChange("")}
          placeholder={lang === "ko" ? "제목, 내용 검색" : "Search titles and content"}
          value={query}
        />
        <div className="shrink-0 md:hidden">
          <DateRangePicker compactLabel lang={lang} label={lang === "ko" ? "필터" : "Filter"} presetType="future" value={{ from: dateFrom, to: dateTo }} onChange={onDateRangeChange} />
        </div>
      </div>
    </div>
  );
}
