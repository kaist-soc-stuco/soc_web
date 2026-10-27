import * as React from "react";
import { Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type TimePickerProps = Pick<React.InputHTMLAttributes<HTMLInputElement>, "id" | "disabled" | "readOnly" | "required" | "min" | "max" | "step" | "className" | "aria-invalid" | "aria-describedby"> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label: string;
  lang: string;
};

/** App-styled time selection composed from shadcn Popover and Button. */
export function TimePicker({ value, onChange, onBlur, label, lang, min, max, step, className, disabled, readOnly, required, ...props }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const korean = lang === "ko";
  const hasSeconds = Number(step ?? 60) < 60 || Boolean(value.split(":")[2]);
  const parts = (value || String(min || "00:00")).split(":").map(Number);
  const pad = (number: number) => String(number).padStart(2, "0");
  const normalized = (time: string) => time.length === 5 ? `${time}:00` : time;
  const minimum = String(min || "00:00:00");
  const maximum = String(max || "23:59:59");
  const makeTime = (part: number, number: number) => {
    const next = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    next[part] = number;
    return next.slice(0, hasSeconds ? 3 : 2).map(pad).join(":");
  };
  const allowed = (part: number, number: number) => {
    const lower = makeTime(part, number).split(":");
    const upper = [...lower];
    for (let index = part + 1; index < 3; index++) { lower[index] = "00"; upper[index] = "59"; }
    return normalized(upper.join(":")) >= normalized(minimum) && normalized(lower.join(":")) <= normalized(maximum);
  };
  const choose = (part: number, number: number) => {
    const candidate = makeTime(part, number);
    onChange(normalized(candidate) < normalized(minimum) ? minimum : normalized(candidate) > normalized(maximum) ? maximum : candidate);
    if (part === (hasSeconds ? 2 : 1)) setOpen(false);
  };
  const columns = korean ? ["시", "분", "초"] : ["Hour", "Minute", "Second"];
  const minuteStep = Number(step ?? 60) >= 60 && Number(step ?? 60) % 60 === 0 ? Math.min(60, Number(step ?? 60) / 60) : 1;
  const secondStep = Number(step ?? 1) > 0 && Number(step) < 60 ? Math.max(1, Math.floor(Number(step))) : 1;

  return <Popover open={open && !disabled && !readOnly} onOpenChange={next => { if (!disabled && !readOnly) setOpen(next); }}>
    <PopoverTrigger asChild>
      <Button {...props} type="button" variant="outline" data-filter-trigger disabled={disabled} aria-disabled={readOnly || undefined} aria-required={required} aria-label={`${label}${value ? `: ${value}` : ""}`} className={cn(className, "w-full justify-between gap-2 text-left font-normal", !value && "text-muted-foreground")} onBlur={event => { if (!contentRef.current?.contains(event.relatedTarget as Node | null)) onBlur?.(); }}>
        <span className="truncate">{value || (korean ? "시간 선택" : "Pick a time")}</span><Clock3 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent ref={contentRef} align="start" className={cn("shadcn-datepicker shadcn-time-picker w-48 p-2", hasSeconds && "w-64")} aria-label={label} onCloseAutoFocus={onBlur} onOpenAutoFocus={event => {
      event.preventDefault();
      const selected = contentRef.current?.querySelectorAll<HTMLButtonElement>('[aria-selected="true"]');
      selected?.forEach(button => {
        const list = button.closest<HTMLElement>('[role="listbox"]');
        const first = list?.querySelector<HTMLElement>('[role="option"]');
        if (list && first) list.scrollTop = button.offsetTop - first.offsetTop - (list.clientHeight - button.clientHeight) / 2;
      });
      const focusTarget = contentRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)') ?? contentRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
      focusTarget?.focus({ preventScroll: true });
    }}>
      <div className="mb-2 flex h-7 items-center justify-between px-1 text-xs text-muted-foreground"><span>{korean ? "24시간 형식" : "24-hour time"}</span><Button type="button" variant="ghost" size="icon" className="size-7 min-h-0" aria-label={korean ? "시간 지우기" : "Clear time"} disabled={!value} onClick={() => { onChange(""); setOpen(false); }}><X className="size-3.5" aria-hidden="true" /></Button></div>
      <div className={cn("grid grid-cols-2 gap-2", hasSeconds && "grid-cols-3")}>
        {columns.slice(0, hasSeconds ? 3 : 2).map((column, part) => <div key={column} className="min-w-0">
          <div className="mb-1 text-center text-xs text-muted-foreground">{column}</div>
          <div role="listbox" aria-label={column} aria-orientation="vertical" className="max-h-56 overflow-y-auto overscroll-contain rounded-md" onKeyDown={event => {
            const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')];
            const index = options.indexOf(event.target as HTMLButtonElement);
            const next = event.key === "ArrowDown" ? Math.min(options.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
            if (next >= 0) { event.preventDefault(); options[next]?.focus(); }
          }}>
            {Array.from({ length: part === 0 ? 24 : 60 }, (_, number) => number).filter(number => part === 0 || number % (part === 1 ? minuteStep : secondStep) === 0).map(number => <Button key={number} type="button" variant="ghost" role="option" aria-selected={number === (parts[part] || 0)} tabIndex={number === (parts[part] || 0) ? 0 : -1} disabled={!allowed(part, number)} className="w-full font-normal tabular-nums" onClick={() => choose(part, number)}>{pad(number)}</Button>)}
          </div>
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}
