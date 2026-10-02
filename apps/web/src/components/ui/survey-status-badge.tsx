import {
  getSurveyStatusInfo,
  type SurveyStatusLike,
  type SurveyStatusTone,
} from "@/lib/survey-display";
import { cn } from "@/lib/utils";

interface SurveyStatusBadgeProps {
  className?: string;
  showDday?: boolean;
  size?: "sm" | "md";
  survey: SurveyStatusLike | null | undefined;
}

const toneClassNames: Record<SurveyStatusTone, string> = {
  beforeOpen: "border-slate-200 bg-white text-slate-600",
  closed: "border-slate-200 bg-slate-200 text-slate-500",
  draft: "border-slate-200 bg-white text-slate-600",
  open: "border-[#cee4d8] bg-[#eaf4ee] text-[#176345]",
};

export function SurveyStatusBadge({
  className,
  showDday = true,
  size = "md",
  survey,
}: SurveyStatusBadgeProps) {
  if (!survey) return null;

  const status = getSurveyStatusInfo(survey, showDday);

  return (
    <span
      className={cn(
        "select-none inline-flex items-center justify-center rounded-full border font-medium whitespace-nowrap",
        size === "sm"
          ? "px-2 py-0.5 text-[length:var(--home-calendar-day-size)]"
          : "px-2.5 py-0.5 text-[length:var(--home-calendar-event-size)]",
        toneClassNames[status.tone],
        className,
      )}
    >
      {status.label}
    </span>
  );
}
