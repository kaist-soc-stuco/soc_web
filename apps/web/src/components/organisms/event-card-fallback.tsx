import { CalendarDays } from "lucide-react";

export function EventCardFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50"
      aria-hidden="true"
    >
      <CalendarDays aria-hidden="true" className="h-8 w-8 text-slate-400" />
    </div>
  );
}
