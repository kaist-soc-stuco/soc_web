import { useLayoutEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { localDate, nowDate } from "@soc/shared";
import { Button } from "./button";

export type DateRange = { from: string; to: string };
export type DateRangePresetType = "past" | "future";

type PresetKind = "today" | "yesterday" | "week" | "month" | "nextMonth";

const stamp = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parse = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return localDate(year, month - 1, day);
};

const sameRange = (left: DateRange, right: DateRange) =>
  left.from === right.from && left.to === right.to;

function getPresetRange(
  kind: PresetKind,
  presetType: DateRangePresetType,
  now = nowDate(),
): DateRange {
  const today = localDate(now.getFullYear(), now.getMonth(), now.getDate());

  if (presetType === "future") {
    if (kind === "week") {
      const from = localDate(today.getFullYear(), today.getMonth(), today.getDate());
      from.setDate(from.getDate() - from.getDay());
      const to = localDate(from.getFullYear(), from.getMonth(), from.getDate());
      to.setDate(to.getDate() + 6);
      return { from: stamp(from), to: stamp(to) };
    }

    if (kind === "month" || kind === "nextMonth") {
      const from = localDate(today.getFullYear(), today.getMonth() + (kind === "nextMonth" ? 1 : 0), 1);
      const to = localDate(from.getFullYear(), from.getMonth() + 1, 0);
      return { from: stamp(from), to: stamp(to) };
    }

    return { from: stamp(today), to: stamp(today) };
  }

  if (kind === "yesterday") {
    const yesterday = localDate(today.getFullYear(), today.getMonth(), today.getDate());
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: stamp(yesterday), to: stamp(yesterday) };
  }

  if (kind === "week" || kind === "month") {
    const from = localDate(today.getFullYear(), today.getMonth(), today.getDate());
    from.setDate(from.getDate() - (kind === "week" ? 6 : 29));
    return { from: stamp(from), to: stamp(today) };
  }

  return { from: stamp(today), to: stamp(today) };
}

/** Date-only filter; a draft range never changes results until Apply. */
export function DateRangePicker({
  value,
  onChange,
  lang = "ko",
  label = lang === "ko" ? "기간 선택" : "Period",
  disableFuture = false,
  align = "end",
  presetType = "past",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  lang?: string;
  label?: string;
  disableFuture?: boolean;
  align?: "start" | "end";
  presetType?: DateRangePresetType;
}) {
  const ko = lang === "ko";
  const todayStamp = stamp(nowDate());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(nowDate());
  const [activePreset, setActivePreset] = useState<PresetKind | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const presetKinds: readonly PresetKind[] = presetType === "future"
    ? ["today", "week", "month", "nextMonth"]
    : ["today", "yesterday", "week", "month"];
  const presetLabels = presetType === "future"
    ? (ko ? ["오늘", "이번 주", "이번 달", "다음 달"] : ["Today", "This week", "This month", "Next month"])
    : (ko ? ["오늘", "어제", "최근 7일", "최근 30일"] : ["Today", "Yesterday", "Last 7 days", "Last 30 days"]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(window.innerWidth - 24, window.innerWidth < 640 ? 320 : 608);
      const height = panel.current?.offsetHeight ?? 430;
      const top = rect.bottom + 8 + height <= window.innerHeight - 12
        ? rect.bottom + 8
        : rect.top - height - 8;
      setPosition({
        left: Math.max(
          12,
          Math.min(
            align === "start" ? rect.left : rect.right - width,
            window.innerWidth - width - 12,
          ),
        ),
        top: Math.max(12, top),
      });
    };

    place();
    panel.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [align, open]);

  const format = (valueToFormat: string) => valueToFormat.replaceAll("-", ".");
  const rangeLabel = value.from || value.to
    ? `${value.from ? format(value.from) : "…"} ~ ${value.to ? format(value.to).slice(value.from.slice(0, 4) === value.to.slice(0, 4) ? 5 : 0) : "…"}`
    : ko ? "전체 기간" : "All dates";
  const rangeSummary = draft.from
    ? `${format(draft.from)} – ${draft.to ? format(draft.to) : ko ? "종료일 선택" : "Select end date"}`
    : ko ? "전체 기간" : "All dates";

  const choose = (day: string) => {
    if (disableFuture && day > todayStamp) return;
    setDraft(previous => !previous.from || previous.to
      ? { from: day, to: "" }
      : { from: day < previous.from ? day : previous.from, to: day < previous.from ? previous.from : day });
  };

  const preset = (kind: PresetKind) => {
    const range = getPresetRange(kind, presetType);
    setDraft(range);
    setActivePreset(kind);
    setMonth(parse(range.from));
  };

  return <>
    <div className="relative inline-flex min-w-0 max-w-full">
      <Button
        type="button"
        ref={trigger}
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: ${rangeLabel}`}
        className={`max-w-full gap-2 font-normal ${value.from || value.to ? "pr-10" : ""}`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setDraft(value);
          setActivePreset(presetKinds.find(kind => sameRange(value, getPresetRange(kind, presetType))) ?? null);
          setMonth(value.from ? parse(value.from) : nowDate());
          setOpen(true);
        }}
      >
        <CalendarDays className="size-4 text-slate-500" />
        <span className="truncate">{rangeLabel}</span>
      </Button>
      {value.from || value.to ? <button
        type="button"
        aria-label={ko ? "기간 선택 해제" : "Clear date range"}
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-brand-primary"
        onClick={() => {
          onChange({ from: "", to: "" });
          close();
        }}
      ><X aria-hidden="true" className="size-3.5" /></button> : null}
    </div>
    {open && createPortal(<div
      ref={panel}
      id={id}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={position}
      className="fixed z-[100] max-h-[calc(100dvh-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg outline-none sm:w-[38rem]"
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
        if (event.key === "Tab") {
          const nodes = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          const visible = Array.from(nodes ?? []).filter(node => node.getClientRects().length);
          const first = visible[0];
          const last = visible.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
        {presetKinds.map((kind, index) => <button
          type="button"
          key={kind}
          onClick={() => preset(kind)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${activePreset === kind ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >{presetLabels[index]}</button>)}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map(offset => {
          const first = localDate(month.getFullYear(), month.getMonth() + offset, 1);
          const count = localDate(first.getFullYear(), first.getMonth() + 1, 0).getDate();
          return <div key={offset} className={offset ? "hidden sm:block" : ""}>
            <div className="mb-2 grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
              {offset === 0 ? <Button type="button" size="icon" variant="ghost" aria-label={ko ? "이전 달" : "Previous month"} onClick={() => setMonth(localDate(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button> : <span />}
              <p className="text-center text-sm font-semibold">{first.toLocaleDateString(ko ? "ko-KR" : "en-US", { year: "numeric", month: "long" })}</p>
              <Button type="button" size="icon" variant="ghost" className={offset === 0 ? "sm:invisible" : ""} disabled={disableFuture && stamp(localDate(month.getFullYear(), month.getMonth() + 1, 1)) > todayStamp} aria-label={ko ? "다음 달" : "Next month"} onClick={() => setMonth(localDate(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs">{(ko ? ["일", "월", "화", "수", "목", "금", "토"] : ["S", "M", "T", "W", "T", "F", "S"]).map((day, index) => <span key={index} className={`py-2 ${index === 0 ? "text-rose-500" : index === 6 ? "text-slate-600" : "text-slate-400"}`}>{day}</span>)}</div>
            <div className="grid grid-cols-7">
              {Array.from({ length: first.getDay() }, (_, index) => <span className="h-9" key={`blank-${index}`} />)}
              {Array.from({ length: count }, (_, index) => {
                const date = localDate(first.getFullYear(), first.getMonth(), index + 1);
                const day = stamp(date);
                const endpoint = day === draft.from || day === draft.to;
                const inRange = Boolean(draft.from && draft.to && day >= draft.from && day <= draft.to);
                const weekday = date.getDay();
                const rangeStart = inRange && (day === draft.from || weekday === 0 || index === 0);
                const rangeEnd = inRange && (day === draft.to || weekday === 6 || index === count - 1);
                const dayColor = weekday === 0 ? "text-rose-600" : "text-slate-700";
                return <span key={day} className={`flex h-9 items-center justify-center transition-[background-color,opacity] duration-150 ${inRange ? `bg-emerald-50 ${rangeStart ? "rounded-l-md" : ""} ${rangeEnd ? "rounded-r-md" : ""}` : ""}`}>
                  <button
                    type="button"
                    disabled={disableFuture && day > todayStamp}
                    aria-label={day}
                    aria-pressed={Boolean(endpoint || inRange)}
                    aria-current={day === todayStamp ? "date" : undefined}
                    onClick={() => {
                      setActivePreset(null);
                      choose(day);
                    }}
                    className={`relative z-10 flex size-8 items-center justify-center text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:!bg-transparent disabled:!text-slate-300 ${endpoint ? "rounded-md bg-brand-primary text-white" : inRange ? "text-emerald-900 hover:bg-emerald-100" : `rounded-md ${dayColor} hover:bg-slate-100`}`}
                  >{index + 1}</button>
                </span>;
              })}
            </div>
          </div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" onClick={() => { onChange({ from: "", to: "" }); setActivePreset(null); close(); }}>{ko ? "초기화" : "Reset"}</Button>
          <p className="min-w-0 truncate text-xs text-slate-500" aria-live="polite">{rangeSummary}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={close}>{ko ? "취소" : "Cancel"}</Button>
          <Button type="button" disabled={Boolean(draft.from && !draft.to) || (disableFuture && (draft.from > todayStamp || draft.to > todayStamp))} onClick={() => { onChange(draft); close(); }}>{ko ? "적용" : "Apply"}</Button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}
