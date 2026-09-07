import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { isoToMs } from "@soc/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void client
      .listPublicVotes()
      .then(setVotes)
      .catch(() => {
        setError(
          lang === "ko"
            ? "투표 목록을 불러오지 못했습니다."
            : "Failed to load votes.",
        );
      })
      .finally(() => setLoading(false));
  }, [client, lang, reloadKey]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader title={lang === "ko" ? "투표" : "Voting"} />
        <PageContainer className="pb-16">
          {loading ? (
            <div className="py-20 text-center text-sm font-normal text-[#344054]">{lang === "ko" ? "불러오는 중..." : "Loading..."}</div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-12 text-center text-sm font-medium text-rose-700">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadKey((current) => current + 1)}
                className="min-h-11 border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-100"
              >
                {lang === "ko" ? "다시 시도" : "Try again"}
              </Button>
            </div>
          ) : votes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center text-sm font-normal text-[#344054]">{lang === "ko" ? "현재 공개된 투표가 없습니다." : "There are no published votes."}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {votes.map((vote) => (
                <Link key={vote.id} to={`/votes/${vote.id}`} className="group min-w-0 select-none rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 sm:p-6">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} />
                    <span className="max-w-full break-words text-xs font-normal text-[#344054] sm:text-right">{dateTime(vote.startsAt, lang === "ko" ? "ko-KR" : "en-US")} – {dateTime(vote.endsAt, lang === "ko" ? "ko-KR" : "en-US")}</span>
                  </div>
                  <h2 className="mt-4 break-words text-lg font-semibold tracking-[-0.02em] text-[#172033] sm:mt-5 sm:text-xl">{lang === "en" && vote.titleEn ? vote.titleEn : vote.titleKo}</h2>
                  {(lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo) ? <p className="mt-2 line-clamp-2 text-sm font-normal leading-6 text-[#344054]">{lang === "en" && vote.descriptionEn ? vote.descriptionEn : vote.descriptionKo}</p> : null}
                  <div className="mt-5 flex flex-col items-start gap-3 text-sm font-normal text-[#344054] sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words">{lang === "ko" ? `전산학부 주전공 학부생 · 참여 ${vote.votedCount}/${vote.eligibleCount}명` : `SoC primary majors · ${vote.votedCount}/${vote.eligibleCount} voted`}</span>
                    <ArrowRight className="size-4 shrink-0 self-end transition-transform group-hover:translate-x-0.5 sm:self-auto" aria-hidden="true" />
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
