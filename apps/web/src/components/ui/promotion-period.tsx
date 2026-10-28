import { nowMs, isoToMs } from "@soc/shared";
import { UiInput } from "./form-control";
import { Badge } from "./badge";

export function PromotionPeriodFields({ start, end, onStart, onEnd, lang }: { start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; lang: string }) {
  return <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
    <label className="space-y-2 text-sm"><span>{lang === "ko" ? "게시 시작 날짜" : "Promotion start date"}</span><UiInput type="date" value={start.slice(0, 10)} onChange={event => onStart(event.target.value)} /></label>
    <label className="space-y-2 text-sm"><span>{lang === "ko" ? "게시 종료 날짜" : "Promotion end date"}</span><UiInput type="date" min={start.slice(0, 10) || undefined} value={end.slice(0, 10)} onChange={event => onEnd(event.target.value)} /></label>
  </div>;
}
export function PromotionStatus({ start, end, lang }: { start?: string | null; end?: string | null; lang: string }) {
  if (!end) return null;
  const now = nowMs();
  const closed = now >= isoToMs(end);
  const upcoming = !closed && Boolean(start && now < isoToMs(start));
  return <Badge className="shrink-0 rounded-md" tone={closed ? "closed" : upcoming ? "upcoming" : "success"}>{lang === "ko" ? closed ? "마감" : upcoming ? "시작 예정" : "진행 중" : closed ? "Closed" : upcoming ? "Upcoming" : "Open"}</Badge>;
}
