import type { VoteRecord } from "@soc/contracts";
import { isoToMs, meetsVoteQuorum, nowMs } from "@soc/shared";
import { Check } from "lucide-react";

type Props = { vote: VoteRecord; lang?: string };

export function VoteTurnout({ vote, lang = "ko" }: Props) {
  const ko = lang === "ko";
  const threshold = vote.quorumPercent;
  const turnout = vote.eligibleCount > 0 ? vote.votedCount * 100 / vote.eligibleCount : 0;
  const met = threshold !== null && meetsVoteQuorum(vote.eligibleCount, vote.votedCount, threshold, vote.quorumInclusive);
  const quorumLabel = threshold === null ? (ko ? "기준 없음" : "Not required") : vote.status === "DRAFT" ? (ko ? "준비 중" : "Pending") : met ? (ko ? "충족" : "Met") : (ko ? "미달" : "Not met");
  return <div className="space-y-3" aria-label={ko ? "투표 참여 현황" : "Turnout summary"}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-xs text-slate-600">
      <p>{ko ? "투표율" : "Turnout"} <strong className="text-sm font-semibold tabular-nums text-slate-900">{turnout.toFixed(1)}%</strong> <span className="ml-1">{ko ? `(투표자 ${vote.votedCount.toLocaleString()}명 / 선거인 ${vote.eligibleCount.toLocaleString()}명)` : `(${vote.votedCount.toLocaleString()} / ${vote.eligibleCount.toLocaleString()})`}</span></p>
      <p>{ko ? "개표 정족수" : "Quorum"}: <span className={met ? "font-medium text-emerald-700" : "font-medium text-slate-700"}>{quorumLabel}</span>{threshold !== null && <span className="ml-1">({ko ? "기준 " : ""}{threshold}% {vote.quorumInclusive ? ko ? "이상" : "or more" : ko ? "초과" : "exceeded"})</span>}</p>
    </div>
    <div className="relative h-2 rounded-full bg-slate-100" role="progressbar" aria-label={ko ? "투표율" : "Turnout"} aria-valuenow={Math.min(100, turnout)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, turnout)}%` }} />
      {threshold !== null && <span aria-hidden="true" className="absolute -top-1 h-4 border-l border-dashed border-slate-400" style={{ left: `${Math.max(0, Math.min(100, threshold))}%` }} />}
    </div>
  </div>;
}

export function VoteProgress({ vote, lang = "ko" }: Props) {
  const ko = lang === "ko";
  const stage = vote.resultsPublishedAt ? 4 : vote.status === "TALLIED" ? 3 : vote.status === "CLOSED" || (vote.status === "PUBLISHED" && nowMs() >= isoToMs(vote.endsAt)) ? 2 : vote.status === "PUBLISHED" && nowMs() >= isoToMs(vote.startsAt) ? 1 : 0;
  const labels = ko ? ["준비", "진행", "마감", "개표", "공개"] : ["Ready", "Open", "Closed", "Tallied", "Public"];
  return <section className="space-y-6" aria-label={ko ? "투표 진행 현황" : "Voting progress"}>
    <ol className="grid grid-cols-5 rounded-xl border border-slate-100 bg-slate-50/60 px-2 py-5 sm:px-4" aria-label={ko ? "운영 단계" : "Operating stages"}>
      {labels.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined} className="relative flex flex-col items-center gap-2">
        {index < labels.length - 1 && <span aria-hidden="true" className={`absolute left-1/2 top-4 h-px w-full ${index < stage ? "bg-emerald-600" : "bg-slate-200"}`} />}
        <span aria-hidden="true" className={`relative z-10 flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${index < stage ? "border-emerald-600 bg-emerald-600 text-white" : index === stage ? "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-50" : "border-slate-200 bg-white text-slate-400"}`}>{index < stage ? <Check className="size-4" /> : index + 1}</span>
        <span className={`text-xs sm:text-sm ${index === stage ? "font-semibold text-emerald-700" : index < stage ? "font-medium text-slate-700" : "text-slate-400"}`}>{label}</span>
      </li>)}
    </ol>
    <VoteTurnout vote={vote} lang={lang} />
  </section>;
}
