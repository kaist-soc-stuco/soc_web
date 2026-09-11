import { useState } from "react";
import { Target } from "lucide-react";

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

function getPledgeStatus(status: string | null | undefined, lang: string) {
  if (status === "COMPLETED") {
    return {
      className: "is-completed",
      label: lang === "ko" ? "완료" : "Completed",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      className: "is-in-progress",
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
            {visiblePledges.map((pledge, index) => {
              const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
              const status = getPledgeStatus(pledge.pledgeStatus, lang);

              return (
                <article key={pledge.contentBlockId} className="about-pledge-item">
                  <div className="about-pledge-item-heading">
                    <span className="about-pledge-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="about-pledge-title">
                      <span>{text.title}</span>
                      {status ? (
                        <span className={`about-pledge-status ${status.className}`}>
                          {status.label}
                        </span>
                      ) : null}
                    </div>
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
