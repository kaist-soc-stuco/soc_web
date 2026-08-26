import { Target } from "lucide-react";

import {
  resolveContentBlockText,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";

const statusMeta = {
  PLANNED: { ko: "예정", en: "Planned" },
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
          <dl className="about-pledge-summary">
            <div className="is-primary">
              <dt>{lang === "ko" ? "이행률" : "Completion"}</dt>
              <dd>
                {counts.COMPLETED}/{pledges.length}
                <span>{completionRate}%</span>
              </dd>
            </div>
            <div><dt>{lang === "ko" ? "진행 중" : "In progress"}</dt><dd>{counts.IN_PROGRESS}</dd></div>
            <div><dt>{lang === "ko" ? "예정" : "Planned"}</dt><dd>{counts.PLANNED}</dd></div>
          </dl>
          <div className="about-pledge-list">
            {pledges.map((pledge, index) => {
              const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
              const status = pledge.pledgeStatus ?? "PLANNED";

              return (
                <article key={pledge.contentBlockId}>
                  <span className="about-pledge-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{text.title}</h3>
                    {text.body ? <p>{text.body}</p> : null}
                  </div>
                  <span className={`about-pledge-status is-${status.toLowerCase().replace("_", "-")}`}>
                    {lang === "ko" ? statusMeta[status].ko : statusMeta[status].en}
                  </span>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
