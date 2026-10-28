import { Badge } from "@/components/ui/badge";
import { isoToMs, nowMs } from "@soc/shared";
import { useLanguage } from "@/hooks/use-language";

export function VoteStatusBadge({ status, startsAt, endsAt }: { status: string; startsAt?: string; endsAt?: string }) {
  const { lang } = useLanguage();
  const now = nowMs();
  const labels = lang === "ko"
    ? { draft: "임시저장", scheduled: "예정", open: "진행 중", ended: "투표 종료", closed: "개표 대기", tallied: "개표 완료" }
    : { draft: "Draft", scheduled: "Upcoming", open: "Open", ended: "Voting ended", closed: "Awaiting tally", tallied: "Tallied" };
  const config = status === "DRAFT"
    ? { label: labels.draft, tone: "draft" as const }
    : status === "PUBLISHED"
      ? startsAt && now < isoToMs(startsAt)
        ? { label: labels.scheduled, tone: "upcoming" as const }
        : endsAt && now >= isoToMs(endsAt)
          ? { label: labels.ended, tone: "closed" as const }
          : { label: labels.open, tone: "success" as const }
      : status === "CLOSED"
        ? { label: labels.closed, tone: "upcoming" as const }
        : { label: labels.tallied, tone: "closed" as const };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
