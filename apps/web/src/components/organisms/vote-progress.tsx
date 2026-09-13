import type { VoteRecord } from "@soc/contracts";
import { isoToMs, meetsVoteQuorum, nowMs } from "@soc/shared";

export function VoteProgress({ vote, lang = "ko" }: { vote: VoteRecord; lang?: string }) {
  const ko = lang === "ko";
  const threshold = vote.quorumPercent ?? 50;
  const met = meetsVoteQuorum(vote.eligibleCount, vote.votedCount, threshold, vote.quorumInclusive);
  const turnout = vote.eligibleCount > 0 ? vote.votedCount * 100 / vote.eligibleCount : 0;
  const stage = vote.resultsPublishedAt ? 4 : vote.status === "TALLIED" ? 3 : vote.status === "CLOSED" || (vote.status === "PUBLISHED" && nowMs() >= isoToMs(vote.endsAt)) ? 2 : vote.status === "PUBLISHED" && nowMs() >= isoToMs(vote.startsAt) ? 1 : 0;
  return <section className="space-y-6" aria-label={ko ? "투표 진행 현황" : "Voting progress"}>
    <ol className="flex items-center text-xs">{(ko ? ["준비", "진행", "마감", "개표", "공개"] : ["Ready", "Open", "Closed", "Tallied", "Public"]).map((label, index) => <li key={label} className="flex min-w-0 flex-1 items-center last:flex-none"><span aria-current={index === stage ? "step" : undefined} className={`whitespace-nowrap rounded-md px-2 py-1.5 ${index === stage ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-400"}`}>{label}</span>{index < 4 ? <span className="mx-1 h-px min-w-1 flex-1 bg-slate-200" /> : null}</li>)}</ol>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4">{[[ko ? "선거인" : "Electors", vote.eligibleCount.toLocaleString()], [ko ? "투표자" : "Voters", vote.votedCount.toLocaleString()], [ko ? "투표율" : "Turnout", `${turnout.toFixed(1)}%`], [ko ? "개표 정족수" : "Quorum", vote.status === "DRAFT" ? ko ? "준비 중" : "Pending" : met ? ko ? "충족" : "Met" : ko ? "미달" : "Not met"]].map(([label, value], index) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 text-xl font-semibold tabular-nums ${index === 3 ? met && vote.status !== "DRAFT" ? "text-emerald-700" : "text-slate-600" : "text-slate-900"}`}>{value}</dd></div>)}</dl>
    <div className="space-y-2"><div className="relative h-2 rounded-full bg-slate-100" role="progressbar" aria-label={ko ? "투표율" : "Turnout"} aria-valuenow={turnout} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-600" style={{width:`${Math.min(100,turnout)}%`}}/><span className="absolute -top-1 h-4 border-l border-dashed border-slate-500" style={{left:`${threshold}%`}}/></div><p className="text-xs text-slate-500">{ko ? `개표 기준 ${threshold}% ${vote.quorumInclusive ? "이상" : "초과"}` : `Threshold: ${vote.quorumInclusive ? "≥" : ">"} ${threshold}%`}</p></div>
  </section>;
}
