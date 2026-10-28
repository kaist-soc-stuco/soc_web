import {
  getSurveyStatusInfo,
  type SurveyStatusLike,
  type SurveyStatusTone,
} from "@/lib/survey-display";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

interface SurveyStatusBadgeProps {
  className?: string;
  showDday?: boolean;
  size?: "sm" | "md";
  survey: SurveyStatusLike | null | undefined;
}

const toneClassNames: Record<SurveyStatusTone, string> = {
  beforeOpen: "border-[#d0d5dd] bg-[#f2f4f7] text-[#344054]",
  closed: "border-transparent bg-[#f2f4f7] text-[#667085]",
  draft: "border-slate-200 bg-white text-slate-600",
  open: "border-[#cee4d8] bg-[#eaf5ef] text-[#075f4a]",
};

export function SurveyStatusBadge({
  className,
  showDday = true,
  size = "md",
  survey,
}: SurveyStatusBadgeProps) {
  const { lang } = useLanguage();
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
      {lang === "en" ? { beforeOpen: "Upcoming", closed: "Closed", draft: "Draft", open: "Open" }[status.tone] : status.label}
    </span>
  );
}
