import { CheckCircle2, Circle, Loader2 } from "lucide-react";

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
        <p className="rounded-xl border border-[#e5e9ec] bg-white px-6 py-16 text-center text-sm font-normal text-[#344054]">
          {lang === "ko" ? "등록된 공약이 없습니다." : "No pledges have been published."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e9ec] bg-white">
          {pledges.map((pledge) => {
            const text = resolveContentBlockText(pledge, lang === "ko" ? "ko" : "en");
            const status = pledge.pledgeStatus ?? "PLANNED";
            const StatusIcon =
              status === "COMPLETED"
                ? CheckCircle2
                : status === "IN_PROGRESS"
                  ? Loader2
                  : Circle;

            return (
              <article
                key={pledge.contentBlockId}
                className="grid gap-4 border-b border-[#e5e9ec] px-6 py-5 last:border-b-0 md:grid-cols-[1fr_auto] md:items-start"
              >
                <div className="min-w-0">
                  <h2 className="text-[15px] font-normal leading-6 text-[#172033]">
                    {text.title}
                  </h2>
                  {text.body ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm font-normal leading-6 text-[#344054]">
                      {text.body}
                    </p>
                  ) : null}
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#e5e9ec] bg-white px-2.5 py-1.5 text-xs font-normal text-[#344054]">
                  <StatusIcon aria-hidden="true" className="size-3.5 text-brand-primary" />
                  {lang === "ko" ? statusMeta[status].ko : statusMeta[status].en}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
