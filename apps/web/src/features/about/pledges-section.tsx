import { useState } from "react";
import { CheckCircle2, Clock, Target, type LucideIcon } from "lucide-react";

import {
  resolveContentBlockText,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";

type PledgeFilter = "ALL" | "IN_PROGRESS" | "COMPLETED";

const filterLabels = {
  ALL: { ko: "전체", en: "All" },
  IN_PROGRESS: { ko: "진행 중", en: "In progress" },
  COMPLETED: { ko: "완료", en: "Completed" },
} as const;

function getPledgeStatus(status: string | null | undefined, lang: string): {
  cardClassName: string;
  badgeClassName: string;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
} | null {
  if (status === "COMPLETED") {
    return {
      cardClassName: "is-completed",
      badgeClassName: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      iconClassName: "text-emerald-600",
      label: lang === "ko" ? "완료" : "Completed",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      cardClassName: "is-in-progress",
      badgeClassName: "border border-blue-200 bg-blue-50 text-blue-700",
      icon: Clock,
      iconClassName: "text-blue-600",
      label: lang === "ko" ? "진행 중" : "In progress",
    };
  }
  return null;
}

export function PledgesSection({ lang }: { lang: string }) {
  const [filter, setFilter] = useState<PledgeFilter>("ALL");
  const pledges = [...usePublicContentBlocksByType("PLEDGE")].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const counts = pledges.reduce(
    (result, pledge) => {
      result[pledge.pledgeStatus ?? "PLANNED"] += 1;
      return result;
    },
    { PLANNED: 0, IN_PROGRESS: 0, COMPLETED: 0 },
  );
  const completionRate = pledges.length
    ? Math.round((counts.COMPLETED / pledges.length) * 100)
    : 0;
  const visiblePledges =
    filter === "ALL"
      ? pledges
      : pledges.filter((pledge) => pledge.pledgeStatus === filter);

  return (
    <div className="about-pledges">
      {pledges.length === 0 ? (
        <div className="about-empty-state flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <Target aria-hidden="true" className="size-5 text-slate-300" />
          <p>
            {lang === "ko" ? "등록된 공약이 없습니다." : "No pledges have been published."}
          </p>
        </div>
      ) : (
        <>
          <div className="about-pledge-toolbar">
            <div
              className="about-pledge-tabs"
              role="tablist"
              aria-label={lang === "ko" ? "공약 상태 필터" : "Pledge status filter"}
            >
              {(Object.keys(filterLabels) as PledgeFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={filter === option}
                  className={filter === option ? "is-active" : undefined}
                  onClick={() => setFilter(option)}
                >
                  {lang === "ko" ? filterLabels[option].ko : filterLabels[option].en}
                </button>
              ))}
            </div>
          </div>

          <div className="about-pledge-overview">
            <div className="about-pledge-progress-summary">
              <div className="about-pledge-progress-heading">
                <div>
                  <span>{lang === "ko" ? "전체 공약 이행률" : "Overall completion"}</span>
                  <strong>{completionRate}%</strong>
                </div>
                <small>
                  {counts.COMPLETED}/{pledges.length} {lang === "ko" ? "개 완료" : "completed"}
                </small>
              </div>
              <div
                className="about-pledge-progress-track"
                role="progressbar"
                aria-label={lang === "ko" ? "공약 이행률" : "Pledge completion"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionRate}
              >
                <span style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="about-pledge-list">
            {visiblePledges.map((pledge) => {
              const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
              const status = getPledgeStatus(pledge.pledgeStatus, lang);
              const StatusIcon = status?.icon ?? Target;

              return (
                <article key={pledge.contentBlockId} className={`about-pledge-item ${status?.cardClassName ?? ""}`}>
                  <div className="about-pledge-item-heading">
                    <StatusIcon aria-hidden="true" className={`size-5 shrink-0 ${status?.iconClassName ?? "text-slate-400"}`} />
                    <div className="about-pledge-title">
                      <span>{text.title}</span>
                    </div>
                    {status ? (
                      <span className={`about-pledge-status ${status.cardClassName} ${status.badgeClassName}`}>
                        {status.label}
                      </span>
                    ) : null}
                  </div>
                  {text.body ? <p>{text.body}</p> : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
