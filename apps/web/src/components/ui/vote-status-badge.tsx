import { Badge } from "@/components/ui/badge";
import { isoToMs, nowMs } from "@soc/shared";
import { useLanguage } from "@/hooks/use-language";

export function VoteStatusBadge({ status, startsAt, endsAt }: { status: string; startsAt?: string; endsAt?: string }) {
  const { lang } = useLanguage();
  const now = nowMs();
  const labels = lang === "ko"
    ? { draft: "초안", scheduled: "예정", open: "진행", ended: "마감", closed: "집계 대기", tallied: "종료" }
    : { draft: "Draft", scheduled: "Scheduled", open: "Open", ended: "Ended", closed: "Awaiting tally", tallied: "Closed" };
  const config = status === "DRAFT"
    ? { label: labels.draft, tone: "neutral" as const }
    : status === "PUBLISHED"
      ? startsAt && now < isoToMs(startsAt)
        ? { label: labels.scheduled, tone: "info" as const }
        : endsAt && now >= isoToMs(endsAt)
          ? { label: labels.ended, tone: "neutral" as const }
          : { label: labels.open, tone: "success" as const }
      : status === "CLOSED"
        ? { label: labels.closed, tone: "warning" as const }
        : { label: labels.tallied, tone: "info" as const };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
