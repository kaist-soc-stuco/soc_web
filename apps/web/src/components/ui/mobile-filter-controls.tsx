import { SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import { UiInput } from "./form-control";

export function MobileFilterButton({ active = false, open, onClick, label = "필터" }: {
  active?: boolean; open: boolean; onClick: () => void; label?: string;
}) {
  return <Button type="button" variant="outline" className="mobile-filter-trigger shrink-0" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
    <SlidersHorizontal className="size-4" aria-hidden="true" />
    {active && <span className="mobile-filter-active-dot" aria-label="필터 적용됨" />}
  </Button>;
}

export function MobileFilterActions({ onReset, onApply, lang }: { onReset: () => void; onApply: () => void; lang: string }) {
  return <><Button type="button" variant="outline" onClick={onReset}>{lang === "ko" ? "초기화" : "Reset"}</Button>
    <Button type="button" onClick={onApply}>{lang === "ko" ? "적용" : "Apply"}</Button></>;
}

export function MobileDateRangeFields({ from, to, onChange, lang }: {
  from: string; to: string; onChange: (value: { from: string; to: string }) => void; lang: string;
}) {
  return <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "기간" : "Period"}</legend>
    <div className="mobile-filter-date-fields">
      <label><span>{lang === "ko" ? "시작일" : "From"}</span><UiInput type="date" aria-label={lang === "ko" ? "시작일" : "From"} value={from} max={to || undefined} onChange={e => onChange({ from: e.target.value, to: to && e.target.value > to ? e.target.value : to })} /></label>
      <label><span>{lang === "ko" ? "종료일" : "To"}</span><UiInput type="date" aria-label={lang === "ko" ? "종료일" : "To"} value={to} min={from || undefined} onChange={e => onChange({ from: from && e.target.value && e.target.value < from ? e.target.value : from, to: e.target.value })} /></label>
    </div>
  </fieldset>;
}
