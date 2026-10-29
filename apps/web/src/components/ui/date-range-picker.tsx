import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { enUS, ko } from "react-day-picker/locale";
import type { DateRange as CalendarRange } from "react-day-picker";
import { nowDate } from "@soc/shared";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatPickerDate, parsePickerDate } from "@/lib/date-picker";
import { UiInput } from "./form-control";

export type DateRange = { from: string; to: string };
export type DateRangePresetType = "past" | "future";

/** shadcn/ui's range Popover + Calendar composition. */
export function DateRangePicker({
  value, onChange, lang = "ko", label = lang === "ko" ? "기간 선택" : "Period",
  disableFuture = false, align = "end", compactLabel = false,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  lang?: string;
  label?: string;
  disableFuture?: boolean;
  align?: "start" | "end";
  presetType?: DateRangePresetType;
  compactLabel?: boolean;
}) {
  const isKorean = lang === "ko";
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(false);
  const today = nowDate();
  const selected: CalendarRange | undefined = value.from ? { from: parsePickerDate(value.from), to: parsePickerDate(value.to) } : undefined;
  const format = (date: string) => date.replaceAll("-", ".");
  const rangeLabel = !compactLabel && (value.from || value.to)
    ? `${value.from ? format(value.from) : "…"} ~ ${value.to ? format(value.to).slice(value.from.slice(0, 4) === value.to.slice(0, 4) ? 5 : 0) : "…"}` : label;

  return <Popover open={open} onOpenChange={setOpen}>
    <div className="shadcn-datepicker relative inline-flex min-w-0 max-w-full">
      <PopoverTrigger asChild><Button type="button" variant="outline" data-filter-trigger aria-label={value.from || value.to ? `${label}: ${rangeLabel}` : label} className={`shadcn-datepicker-control ui-filter-trigger max-w-full justify-start gap-2 font-normal ${value.from || value.to ? "pr-10" : ""}`}>
        <CalendarIcon aria-hidden="true" className="size-4 text-muted-foreground" /><span className="truncate">{rangeLabel}</span>
      </Button></PopoverTrigger>
      {(value.from || value.to) && <button type="button" aria-label={isKorean ? "기간 선택 해제" : "Clear date range"} className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { onChange({ from: "", to: "" }); setOpen(false); }}><X aria-hidden="true" className="size-3.5" /></button>}
    </div>
    <PopoverContent align={align} className="shadcn-datepicker w-auto max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0" aria-label={label}>
      {isMobile ? <div className="grid w-[min(22rem,calc(100vw-2rem))] grid-cols-2 gap-3 p-4">
        <label className="min-w-0 space-y-1 text-xs text-slate-600"><span>{isKorean ? "시작일" : "From"}</span><UiInput type="date" value={value.from} max={value.to || (disableFuture ? formatPickerDate(today) : undefined)} onChange={event => onChange({ from: event.currentTarget.value, to: value.to && event.currentTarget.value > value.to ? event.currentTarget.value : value.to })} /></label>
        <label className="min-w-0 space-y-1 text-xs text-slate-600"><span>{isKorean ? "종료일" : "To"}</span><UiInput type="date" value={value.to} min={value.from || undefined} max={disableFuture ? formatPickerDate(today) : undefined} onChange={event => onChange({ from: value.from && event.currentTarget.value && event.currentTarget.value < value.from ? event.currentTarget.value : value.from, to: event.currentTarget.value })} /></label>
      </div> : <Calendar mode="range" selected={selected} defaultMonth={selected?.from} onSelect={range => onChange({ from: range?.from ? formatPickerDate(range.from) : "", to: range?.to ? formatPickerDate(range.to) : "" })} numberOfMonths={2} locale={isKorean ? ko : enUS} disabled={disableFuture ? { after: today } : undefined} endMonth={disableFuture ? today : undefined} autoFocus />}
    </PopoverContent>
  </Popover>;
}
