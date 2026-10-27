import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { resolveContentBlockText, usePublicContentBlocksByType } from "@/features/site-content/site-content";

type PledgeFilter = "ALL" | "IN_PROGRESS" | "COMPLETED";
const FILTERS = { ALL: { ko: "전체", en: "All" }, IN_PROGRESS: { ko: "진행 중", en: "In progress" }, COMPLETED: { ko: "완료", en: "Completed" } } as const;

export function PledgesSection({ lang }: { lang: string }) {
  const [filter, setFilter] = useState<PledgeFilter>("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const resultId = useId();
  const korean = lang === "ko";
  const pledges = [...usePublicContentBlocksByType("PLEDGE")].sort((left, right) => left.sortOrder - right.sortOrder);
  const completed = pledges.filter(pledge => pledge.pledgeStatus === "COMPLETED").length;
  const rate = pledges.length ? Math.round(completed / pledges.length * 100) : 0;
  const visible = filter === "ALL" ? pledges : pledges.filter(pledge => pledge.pledgeStatus === filter);
  const counts = { ALL: pledges.length, IN_PROGRESS: pledges.filter(pledge => pledge.pledgeStatus === "IN_PROGRESS").length, COMPLETED: completed };
  if (!pledges.length) return <p className="tree-empty">{korean ? "등록된 공약이 없습니다." : "No pledges have been published."}</p>;

  return <div className="tree-pledges" data-ui="pledge-progress">
    <div className="tree-pledge-overview" data-tree-reveal>
      <p>{korean ? `${pledges.length}개 공약 중 ${completed}개 완료` : `${completed} of ${pledges.length} pledges completed`}</p>
      <strong>{rate}%</strong>
      <div className="tree-progress-track" role="progressbar" aria-label={korean ? "공약 이행률" : "Pledge completion"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate} aria-valuetext={korean ? `${pledges.length}개 중 ${completed}개 완료` : `${completed} of ${pledges.length} completed`}>
        {pledges.map((pledge, index) => <span key={pledge.contentBlockId} data-completed={index < completed} aria-hidden="true" />)}
      </div>
      <p className="tree-pledge-note">{korean ? "각 공약을 펼쳐 자세한 내용을 확인하세요." : "Open each pledge to see the details."}</p>
    </div>
    <div>
      <div className="tree-pledge-filters" role="group" aria-label={korean ? "공약 상태 필터" : "Pledge status filter"}>
        {(Object.keys(FILTERS) as PledgeFilter[]).map(option => <button key={option} type="button" aria-pressed={filter === option} aria-controls={resultId} onClick={() => setFilter(option)}>{korean ? FILTERS[option].ko : FILTERS[option].en}<span className="tree-pledge-count">{counts[option]}</span></button>)}
      </div>
      <p className="sr-only" role="status">{korean ? `${visible.length}개 공약` : `${visible.length} pledges`}</p>
      <div id={resultId} className="tree-pledge-list">
        {visible.map((pledge, index) => {
          const text = resolveContentBlockText(pledge, korean ? "ko" : "en");
          const status = pledge.pledgeStatus === "COMPLETED" ? "completed" : pledge.pledgeStatus === "IN_PROGRESS" ? "progress" : "planned";
          const label = status === "completed" ? korean ? "완료" : "Completed" : status === "progress" ? korean ? "진행 중" : "In progress" : korean ? "시작 예정" : "Upcoming";
          return <details key={pledge.contentBlockId} className="tree-pledge-item" open={expanded[pledge.contentBlockId] ?? index === 0} onToggle={event => {
            const open = event.currentTarget.open;
            setExpanded(previous => (previous[pledge.contentBlockId] ?? index === 0) === open ? previous : { ...previous, [pledge.contentBlockId]: open });
          }}>
            <summary><h3>{text.title}</h3><Badge className="tree-pledge-status" tone={status === "completed" ? "success" : status === "progress" ? "info" : "neutral"}>{label}</Badge><ChevronDown aria-hidden="true" /></summary>
            <div>{text.body ? <p>{text.body}</p> : <p>{korean ? "상세 진행 내용이 아직 등록되지 않았습니다." : "A detailed progress report has not been added yet."}</p>}</div>
          </details>;
        })}
        {!visible.length && <p className="tree-empty">{korean ? "해당 상태의 공약이 없습니다." : "No pledges with this status."}</p>}
      </div>
    </div>
  </div>;
}
