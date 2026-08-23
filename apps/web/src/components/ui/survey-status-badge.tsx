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
  beforeOpen: "border-amber-200 bg-amber-50 text-amber-700",
  closed: "border-rose-200 bg-rose-50 text-rose-700",
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  open: "border-brand-primary-border bg-brand-primary-light text-brand-primary",
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
        "inline-flex items-center justify-center rounded-md border font-semibold whitespace-nowrap",
        size === "sm"
          ? "px-2 py-0.5 text-[10.5px]"
          : "px-2.5 py-0.5 text-[11.5px]",
        toneClassNames[status.tone],
        className,
      )}
    >
      {status.label}
    </span>
  );
}
