import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { isoToMs } from "@soc/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

const dateTime = (value: string, locale: string) => new Intl.DateTimeFormat(locale, {
  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(isoToMs(value));

export function VoteListPage() {
  const { lang } = useLanguage();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void client.listPublicVotes().then(setVotes).finally(() => setLoading(false));
  }, [client]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader title={lang === "ko" ? "투표" : "Voting"} />
        <PageContainer className="pb-16">
          <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-5 text-sm font-normal text-[#344054]">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand-primary" aria-hidden="true" />
            <p>{lang === "ko" ? "투표 시작 시점에 확정된 전산학부 주전생 명부로 본인 인증하며, 투표 내용은 참여 기록과 분리해 저장합니다." : "Eligibility is verified against the School of Computing primary-major voter roll fixed at publication. Ballots are stored separately from participation records."}</p>
          </div>
          {loading ? (
            <div className="py-20 text-center text-sm font-normal text-[#344054]">{lang === "ko" ? "불러오는 중..." : "Loading..."}</div>
          ) : votes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center text-sm font-normal text-[#344054]">{lang === "ko" ? "현재 공개된 투표가 없습니다." : "There are no published votes."}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {votes.map((vote) => (
                <Link key={vote.id} to={`/votes/${vote.id}`} className="group rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} />
                    <span className="text-xs font-normal text-[#344054]">{dateTime(vote.startsAt, lang === "ko" ? "ko-KR" : "en-US")} – {dateTime(vote.endsAt, lang === "ko" ? "ko-KR" : "en-US")}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#172033]">{lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo}</h2>
                  {(lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo) ? <p className="mt-2 line-clamp-2 text-sm font-normal leading-6 text-[#344054]">{lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo}</p> : null}
                  <div className="mt-6 flex items-center justify-between text-sm font-normal text-[#344054]">
                    <span>{lang === "ko" ? `전산학부 주전생 · 참여 ${vote.votedCount}/${vote.eligibleCount}명` : `SoC primary majors · ${vote.votedCount}/${vote.eligibleCount} voted`}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
