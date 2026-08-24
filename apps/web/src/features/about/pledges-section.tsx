import { CheckCircle2, Circle, CircleDashed, Target } from "lucide-react";

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

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      {pledges.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Target aria-hidden="true" className="size-5 text-slate-300" />
          <p className="text-sm font-normal text-[#344054]">
            {lang === "ko" ? "등록된 공약이 없습니다." : "No pledges have been published."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {pledges.map((pledge) => {
            const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
            const status = pledge.pledgeStatus ?? "PLANNED";
            const StatusIcon =
              status === "COMPLETED"
                ? CheckCircle2
                : status === "IN_PROGRESS"
                  ? Circle
                  : CircleDashed;

            return (
              <article
                key={pledge.contentBlockId}
                className="flex gap-3 py-5 first:pt-0 last:pb-0"
              >
                <StatusIcon
                  aria-hidden="true"
                  className={`mt-1 size-4 shrink-0 ${
                    status === "COMPLETED"
                      ? "text-emerald-600"
                      : status === "IN_PROGRESS"
                        ? "text-brand-primary"
                        : "text-slate-400"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="text-[length:var(--ui-text-section-size)] font-semibold leading-6 text-[var(--ui-text-strong)]">
                      {text.title}
                    </h2>
                    <span className="text-xs font-medium text-slate-500">
                      {lang === "ko" ? statusMeta[status].ko : statusMeta[status].en}
                    </span>
                  </div>
                  {text.body ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-6 text-[#344054]">
                      {text.body}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
