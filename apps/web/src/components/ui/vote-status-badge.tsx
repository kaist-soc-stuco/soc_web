import { Badge } from "@/components/ui/badge";
import { isoToMs, nowMs } from "@soc/shared";
import { useLanguage } from "@/hooks/use-language";

export function VoteStatusBadge({ status, startsAt, endsAt }: { status: string; startsAt?: string; endsAt?: string }) {
  const { lang } = useLanguage();
  const now = nowMs();
  const labels = lang === "ko"
    ? { draft: "임시저장", scheduled: "예정", open: "진행", ended: "마감", closed: "마감", tallied: "종료" }
    : { draft: "Draft", scheduled: "Scheduled", open: "Open", ended: "Ended", closed: "Awaiting tally", tallied: "Closed" };
  const config = status === "DRAFT"
    ? { label: labels.draft, tone: "draft" as const }
    : status === "PUBLISHED"
      ? startsAt && now < isoToMs(startsAt)
        ? { label: labels.scheduled, tone: "neutral" as const }
        : endsAt && now >= isoToMs(endsAt)
          ? { label: labels.ended, tone: "closed" as const }
          : { label: labels.open, tone: "success" as const }
      : status === "CLOSED"
        ? { label: labels.closed, tone: "closed" as const }
        : { label: labels.tallied, tone: "closed" as const };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
