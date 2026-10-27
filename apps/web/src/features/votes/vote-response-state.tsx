import { CheckCircle2, Clock, Copy, Lock, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ResponseStateCard, responseStateActionClassName } from "@/features/survey/response-state-card";
import { VoteListAction } from "@/features/survey/response-layout";

export function VoteNoticeState({ kind, lang, onRetry }: {
  kind: "upcoming" | "closed" | "failed" | "results-failed";
  lang: string;
  onRetry?: () => void;
}) {
  const ko = lang === "ko";
  const failed = kind === "failed" || kind === "results-failed";
  return <ResponseStateCard icon={failed ? WifiOff : kind === "upcoming" ? Clock : Lock}
    headingAs={kind === "upcoming" || kind === "failed" ? "h1" : "h2"}
    tone={kind === "upcoming" ? "warning" : "neutral"} role={failed ? "alert" : undefined}
    title={ko ? ({ upcoming: "아직 시작되지 않은 투표입니다", closed: "마감된 투표입니다", failed: "투표를 불러오지 못했습니다", "results-failed": "투표 결과를 불러오지 못했습니다" }[kind]) : ({ upcoming: "This vote has not started yet", closed: "This vote has ended", failed: "Could not load this vote", "results-failed": "Could not load voting results" }[kind])}
    description={failed ? ko ? "일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요." : "This may be a temporary issue. Please try again shortly." : kind === "upcoming" ? ko ? "투표가 시작되면 참여할 수 있습니다." : "You can participate once voting opens." : ko ? "참여 기간이 종료되어 더 이상 참여할 수 없습니다." : "The voting period has ended. No further ballots are accepted."}
    actions={failed ? <Button type="button" className={responseStateActionClassName} onClick={onRetry}>{ko ? "다시 시도" : "Try again"}</Button> : <VoteListAction lang={lang} />}
  />;
}

export function VoteResponseState({ receipt, lang, verifying, verified, onCopy, onVerify }: {
  receipt?: string | null;
  lang: string;
  verifying: boolean;
  verified: boolean;
  onCopy: () => void;
  onVerify: () => void;
}) {
  const ko = lang === "ko";
  const verifyAction = (mobile = false) => <Button type="button" variant={mobile ? "outline" : "default"} className={responseStateActionClassName} loading={verifying} disabled={verifying || verified} onClick={onVerify}>
    {ko ? verified ? "접수 확인 완료" : "접수 확인" : verified ? "Receipt verified" : "Verify receipt"}
  </Button>;
  return <ResponseStateCard className="vote-response-state min-h-[26rem] py-6" icon={CheckCircle2} tone="success"
    title={ko ? receipt ? "투표가 완료되었습니다" : "이미 투표를 마쳤습니다" : receipt ? "Your ballot was submitted" : "You have already voted"}
    description={ko ? receipt ? "접수 번호로 정상 접수 여부를 확인할 수 있습니다." : "이 투표에는 한 번만 참여할 수 있습니다." : receipt ? "Use your receipt number to verify that your ballot was received." : "You can participate in this vote only once."}
    actions={<div className="flex max-w-full flex-wrap justify-center gap-2">
      {receipt ? verifyAction() : null}
      <Button asChild variant={receipt ? "outline" : "default"} className={`${responseStateActionClassName}${receipt ? " !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50" : ""}`}>
        <Link to="/votes">{ko ? "목록으로" : "Back to votes"}</Link>
      </Button>
    </div>}
    mobileAction={<VoteListAction lang={lang} />}
  >
    {receipt ? <div className="flex max-w-full flex-col items-center gap-2">
      <span className="sr-only">{ko ? "접수 번호" : "Receipt number"}</span>
      <div className="flex max-w-full items-center gap-2 rounded-lg bg-slate-50 py-1 pl-3 pr-1">
        <code className="min-w-0 break-all font-mono text-sm font-medium tracking-wide text-slate-700">{receipt}</code>
        <IconButton size="sm" aria-label={ko ? "접수 번호 복사" : "Copy receipt number"} onClick={onCopy}><Copy aria-hidden="true" className="size-4" /></IconButton>
      </div>
      <div className="vote-mobile-receipt-action md:hidden">{verifyAction(true)}</div>
    </div> : null}
  </ResponseStateCard>;
}
