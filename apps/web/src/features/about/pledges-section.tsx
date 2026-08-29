import { ChevronDown, Target } from "lucide-react";

import {
  resolveContentBlockText,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";

const statusMeta = {
  PLANNED: { ko: "준비 중", en: "Planned" },
  IN_PROGRESS: { ko: "진행 중", en: "In progress" },
  COMPLETED: { ko: "이행 완료", en: "Completed" },
} as const;

export function PledgesSection({ lang }: { lang: string }) {
  const pledges = usePublicContentBlocksByType("PLEDGE");
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
          <div className="about-pledge-overview">
            <div className="about-pledge-progress-panel">
              <div className="about-pledge-progress-heading">
                <div>
                  <span>{lang === "ko" ? "전체 공약 이행률" : "Overall completion"}</span>
                  <strong>{completionRate}%</strong>
                </div>
                <small>{counts.COMPLETED}/{pledges.length} {lang === "ko" ? "개 완료" : "completed"}</small>
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
            <dl className="about-pledge-metrics">
              <div><dt>{lang === "ko" ? "진행 중" : "In progress"}</dt><dd>{counts.IN_PROGRESS}</dd></div>
              <div><dt>{lang === "ko" ? "준비 중" : "Planned"}</dt><dd>{counts.PLANNED}</dd></div>
            </dl>
          </div>
          <div className="about-pledge-list">
            {pledges.map((pledge, index) => {
              const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
              const status = pledge.pledgeStatus ?? "PLANNED";

              return (
                <details key={pledge.contentBlockId} className="about-pledge-item">
                  <summary className="select-none">
                    <span className="about-pledge-summary-copy">
                      <span className="about-pledge-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="about-pledge-title">
                        <span>{text.title}</span>
                        <small className={`about-pledge-status is-${status.toLowerCase().replace("_", "-")}`}>
                          {lang === "ko" ? statusMeta[status].ko : statusMeta[status].en}
                        </small>
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className="about-pledge-chevron" />
                  </summary>
                  {text.body ? <p>{text.body}</p> : null}
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
