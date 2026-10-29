import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { enUS, ko } from "react-day-picker/locale";

import { useLanguage } from "@/hooks/use-language";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatPickerDate, parsePickerDate, replacePickerDate } from "@/lib/date-picker";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { TimePicker } from "./time-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** shadcn/ui's single-date Popover + Calendar composition. */
export function DatePicker({ value, onChange, lang = "ko", children }: {
  value?: Date;
  onChange: (value: Date) => void;
  lang?: string;
  children?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  if (isMobile) return <span className="relative inline-flex min-w-0">
    <span aria-hidden="true" inert>{children ?? <Button type="button" variant="outline" className="shadcn-datepicker-control font-normal"><CalendarIcon aria-hidden="true" />{value ? formatPickerDate(value) : lang === "ko" ? "날짜 선택" : "Pick a date"}</Button>}</span>
    <input type="date" aria-label={lang === "ko" ? "날짜 선택" : "Pick a date"} value={value ? formatPickerDate(value) : ""} className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0" onChange={event => { const date = parsePickerDate(event.currentTarget.value); if (date) onChange(date); }} />
  </span>;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>{children ?? <Button type="button" variant="outline" data-filter-trigger className="shadcn-datepicker shadcn-datepicker-control justify-start font-normal"><CalendarIcon aria-hidden="true" />{value ? formatPickerDate(value) : lang === "ko" ? "날짜 선택" : "Pick a date"}</Button>}</PopoverTrigger>
    <PopoverContent className="shadcn-datepicker w-auto p-0" align="start" aria-label={lang === "ko" ? "날짜 선택" : "Pick a date"}>
      <Calendar mode="single" selected={value} defaultMonth={value} locale={lang === "ko" ? ko : enUS} autoFocus onSelect={date => { if (date) { onChange(date); setOpen(false); } }} />
    </PopoverContent>
  </Popover>;
}

/** Keep UiInput's native value, validation, ref and change-event contract for forms. */
export const DatePickerInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "date", value, defaultValue, disabled, readOnly, onChange, onFocus, onInvalid, ...props }, forwardedRef) => {
    const { lang } = useLanguage();
    const isMobile = useMediaQuery("(max-width: 767px)");
    const koLanguage = lang === "ko";
    const withTime = type === "datetime-local";
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(String(defaultValue ?? ""));
    const [timeBeforeDate, setTimeBeforeDate] = React.useState("");
    const [dateWithoutTime, setDateWithoutTime] = React.useState("");
    const [labelText, setLabelText] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const generatedId = React.useId();
    const id = props.id ?? generatedId;
    const currentValue = value === undefined ? uncontrolledValue : String(value ?? "");
    const selected = parsePickerDate(currentValue || (withTime ? dateWithoutTime : ""));
    const timeValue = currentValue.split("T")[1] || (selected && !dateWithoutTime ? "00:00" : timeBeforeDate);
    const min = String(props.min ?? "");
    const max = String(props.max ?? "");
    const minDate = parsePickerDate(min);
    const maxDate = parsePickerDate(max);
    const locale = koLanguage ? ko : enUS;
    const placeholder = withTime ? (koLanguage ? "날짜 선택" : "Pick a date") : props.placeholder || (koLanguage ? "날짜 선택" : "Pick a date");

    React.useImperativeHandle(forwardedRef, () => inputRef.current!, [isMobile]);
    React.useLayoutEffect(() => {
      const input = inputRef.current;
      const label = input?.labels?.[0] ?? input?.parentElement?.parentElement?.querySelector("label");
      setLabelText(label?.textContent?.trim() || input?.closest('[role="group"]')?.getAttribute("aria-label") || "");
    }, [id, lang]);
    React.useEffect(() => {
      const form = inputRef.current?.form;
      const reset = () => { if (value === undefined) setUncontrolledValue(String(defaultValue ?? "")); setTimeBeforeDate(""); setDateWithoutTime(""); };
      form?.addEventListener("reset", reset);
      return () => form?.removeEventListener("reset", reset);
    }, [defaultValue, value]);

    const commit = (next: string) => {
      const input = inputRef.current;
      if (!input || disabled || readOnly) return;
      // Let React create the real change event, with the original native input as currentTarget.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const displayValue = selected ? formatPickerDate(selected).replaceAll("-", ".") : "";
    const accessibleLabel = props["aria-label"] || labelText || placeholder;
    const controlClassName = cn("shadcn-datepicker-control h-[var(--ui-control-height)] min-w-0 rounded-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white px-3 text-sm font-normal text-[#344054] outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60", className);
    const widthClassName = className?.split(/\s+/).filter(token => /^(?:[\w-]+:)*(?:w-|min-w-|max-w-)/.test(token)).join(" ");
    const notifyBlur = () => inputRef.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    if (isMobile) return <input {...props} id={id} ref={inputRef} type={type} value={currentValue} disabled={disabled} readOnly={readOnly} className={cn(controlClassName, "native-date-input w-full max-w-full")} onFocus={onFocus} onInvalid={onInvalid} onChange={event => { setUncontrolledValue(event.currentTarget.value); onChange?.(event); }} />;

    return <span className={cn("shadcn-datepicker relative w-full min-w-0 max-w-full", withTime ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2" : "inline-flex", widthClassName)} data-slot="date-picker-input">
      <input {...props} id={id} ref={inputRef} type={type} value={value} defaultValue={defaultValue} disabled={disabled} readOnly={readOnly} tabIndex={-1} className="sr-only" aria-hidden="true"
        onChange={event => { setUncontrolledValue(event.currentTarget.value); onChange?.(event); }}
        onFocus={event => { onFocus?.(event); if (!disabled && !readOnly) { triggerRef.current?.focus({ preventScroll: true }); setOpen(true); } }}
        onInvalid={event => { onInvalid?.(event); if (!event.defaultPrevented) { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }); setOpen(true); } }}
      />
      <Popover open={open && !disabled && !readOnly} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button ref={triggerRef} type="button" variant="outline" data-filter-trigger disabled={disabled} aria-disabled={readOnly || undefined} aria-required={props.required} aria-invalid={props["aria-invalid"]} aria-describedby={props["aria-describedby"]} aria-labelledby={props["aria-labelledby"]} aria-label={`${accessibleLabel}${withTime ? koLanguage ? " 날짜" : " date" : ""}${displayValue ? `: ${displayValue}` : ""}`} className={cn(controlClassName, "w-full justify-between gap-2 text-left", !displayValue && "text-muted-foreground")}>
          <span className="truncate">{displayValue || placeholder}</span><CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button></PopoverTrigger>
        <PopoverContent className="shadcn-datepicker w-auto p-0" align="start" aria-label={accessibleLabel} onCloseAutoFocus={notifyBlur}>
          <Calendar mode="single" selected={selected} defaultMonth={selected ?? minDate} locale={locale} startMonth={minDate} endMonth={maxDate} disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]} autoFocus onSelect={date => {
            if (!date) {
              setDateWithoutTime("");
              setTimeBeforeDate(withTime ? timeValue : "");
              commit("");
            } else if (withTime && dateWithoutTime && !currentValue) {
              setDateWithoutTime(formatPickerDate(date));
            } else {
              commit(replacePickerDate(currentValue || (timeBeforeDate ? `T${timeBeforeDate}` : ""), date, withTime, min, max));
              setTimeBeforeDate("");
              setDateWithoutTime("");
            }
            setOpen(false);
          }} />
        </PopoverContent>
      </Popover>
      {withTime && <TimePicker id={`${id}-time`} label={`${accessibleLabel} ${koLanguage ? "시간" : "time"}`} lang={lang} aria-invalid={props["aria-invalid"]} aria-describedby={props["aria-describedby"]} step={props.step} disabled={disabled} readOnly={readOnly} required={props.required} value={timeValue} min={selected && min.slice(0, 10) === formatPickerDate(selected) ? min.split("T")[1] : undefined} max={selected && max.slice(0, 10) === formatPickerDate(selected) ? max.split("T")[1] : undefined} onBlur={notifyBlur} onChange={time => {
        setTimeBeforeDate(time);
        if (selected) {
          setDateWithoutTime(time ? "" : formatPickerDate(selected));
          commit(time ? `${formatPickerDate(selected)}T${time}` : "");
        }
      }} className={controlClassName} />}
    </span>;
  },
);
DatePickerInput.displayName = "DatePickerInput";
