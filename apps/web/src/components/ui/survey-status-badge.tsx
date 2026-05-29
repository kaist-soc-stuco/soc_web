import { cn } from "@/lib/utils";

interface SurveyStatusLike {
  closesAt?: string | null;
  isPublished?: boolean | null;
  opensAt?: string | null;
  status?: string | null;
}

type SurveyStatusTone = "draft" | "closed" | "beforeOpen" | "open";

interface SurveyStatusInfo {
  label: string;
  tone: SurveyStatusTone;
}

function getDdayText(closesAt?: string | null) {
  if (!closesAt) return "";

  const now = new Date();
  const closeDate = new Date(closesAt);
  if (Number.isNaN(closeDate.getTime())) return "";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const closeDay = new Date(
    closeDate.getFullYear(),
    closeDate.getMonth(),
    closeDate.getDate(),
  );
  const diffDays = Math.ceil(
    (closeDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays > 0) return ` · D-${diffDays}`;
  if (diffDays === 0) return " · D-Day";
  return "";
}

export function getSurveyStatusInfo(
  survey: SurveyStatusLike,
  showDday = true,
): SurveyStatusInfo {
  const now = new Date();
  const opensAt = survey.opensAt ? new Date(survey.opensAt) : null;
  const closesAt = survey.closesAt ? new Date(survey.closesAt) : null;

  if (survey.status === "draft") {
    return { label: "임시저장", tone: "draft" };
  }

  if (
    survey.status === "closed" ||
    (closesAt && !Number.isNaN(closesAt.getTime()) && closesAt < now)
  ) {
    return { label: "마감", tone: "closed" };
  }

  if (opensAt && !Number.isNaN(opensAt.getTime()) && opensAt > now) {
    return { label: "개시 전", tone: "beforeOpen" };
  }

  if (survey.status === "open" || survey.isPublished) {
    return {
      label: `진행중${showDday ? getDdayText(survey.closesAt) : ""}`,
      tone: "open",
    };
  }

  return { label: "마감", tone: "closed" };
}

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
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
        "inline-flex items-center justify-center rounded-md border font-extrabold whitespace-nowrap",
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
