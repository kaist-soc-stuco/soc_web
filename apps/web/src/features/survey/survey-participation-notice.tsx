import type {
  SurveyParticipationEligibility,
  SurveyParticipationEligibilityReason,
} from "@soc/contracts";
import { CircleAlert, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rememberAuthReturnPath } from "@/lib/auth-storage";
import { useOpenChannelTalk } from "@/features/channel-talk/channel-talk-provider";
import { ResponseStateCard, responseStateActionClassName } from "./response-state-card";
import { SurveyListAction, VoteListAction } from "./response-layout";

interface SurveyParticipationNoticeProps {
  eligibility: SurveyParticipationEligibility;
  lang: string;
  compact?: boolean;
  description?: string;
  subject?: "survey" | "vote";
}

const reasonLabels: Record<
  Exclude<SurveyParticipationEligibilityReason, "LOGIN_REQUIRED">,
  { ko: string; en: string }
> = {
  PRIMARY_MAJOR_REQUIRED: {
    ko: "주전공이 전산학부가 아닙니다.",
    en: "Your primary major is not the School of Computing.",
  },
  ACADEMIC_STATUS_REQUIRED: {
    ko: "설문에서 요구하는 학적 상태가 아닙니다.",
    en: "Your academic status does not meet this survey's requirement.",
  },
  FEE_PAYER_REQUIRED: {
    ko: "과비 납부 내역이 확인되지 않습니다.",
    en: "Your student-fee payment could not be verified.",
  },
  FEE_CONSENT_REQUIRED: {
    ko: "이번 학기 과비 개인정보 동의가 필요합니다.",
    en: "Your student-fee privacy consent is required for this semester.",
  },
};

const getReasonLabel = (
  reason: Exclude<SurveyParticipationEligibilityReason, "LOGIN_REQUIRED">,
  lang: string,
) => reasonLabels[reason][lang === "ko" ? "ko" : "en"];

export function SurveyParticipationNotice({
  eligibility,
  lang,
  compact = false,
  subject = "survey",
  description,
}: SurveyParticipationNoticeProps) {
  const openSupport = useOpenChannelTalk();
  if (
    eligibility.status !== "LOGIN_REQUIRED" &&
    eligibility.status !== "NOT_ELIGIBLE"
  ) {
    return null;
  }

  const isLoginRequired = eligibility.status === "LOGIN_REQUIRED";
  const reasons = eligibility.reasons.filter(
    (reason): reason is Exclude<SurveyParticipationEligibilityReason, "LOGIN_REQUIRED"> =>
      reason !== "LOGIN_REQUIRED",
  );

  const reasonList = !isLoginRequired && reasons.length > 0 ? (
    <ul className={cn("survey-eligibility-reasons max-w-full space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-left text-sm font-normal leading-5 text-amber-900", compact ? "w-full" : "w-fit")}>
      {reasons.map(reason => <li key={reason} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="break-keep">{getReasonLabel(reason, lang)}</span>
        </span>
        {reason === "FEE_PAYER_REQUIRED" ? <button type="button" onClick={openSupport}
          className="ml-auto shrink-0 rounded-sm text-[length:var(--ui-text-body-sm-size)] font-medium text-amber-900 underline underline-offset-4 hover:text-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">
          {lang === "ko" ? "이미 납부하셨나요?" : "Already paid?"}
        </button> : null}
        {reason === "FEE_CONSENT_REQUIRED" ? <Link to="/mypage#fee-consent" className="ml-auto shrink-0 font-medium underline underline-offset-4">
          {lang === "ko" ? "동의하러 가기" : "Review consent"}
        </Link> : null}
      </li>)}
    </ul>
  ) : null;

  if (!compact) return <ResponseStateCard className="survey-participation-notice"
    icon={isLoginRequired ? LockKeyhole : ShieldAlert} tone={isLoginRequired ? "neutral" : "warning"}
    title={lang === "ko" ? isLoginRequired ? `로그인이 필요한 ${subject === "vote" ? "투표" : "설문"}입니다` : "참여 조건을 충족하지 않습니다" : isLoginRequired ? "Login required" : "You are not eligible to participate"}
    description={description ?? (lang === "ko" ? isLoginRequired ? "참여하려면 KAIST 계정으로 로그인해 주세요." : "아래 사유로 참여할 수 없습니다." : isLoginRequired ? "Sign in with your KAIST account to participate." : "You cannot participate for the following reasons.")}
    actions={isLoginRequired ? <Button asChild className={responseStateActionClassName}><Link to="/login" onClick={() => rememberAuthReturnPath()}>{lang === "ko" ? "로그인" : "Sign in"}</Link></Button> : undefined}
    mobileAction={!isLoginRequired ? subject === "vote" ? <VoteListAction lang={lang} /> : <SurveyListAction lang={lang} /> : undefined}
  >
    {reasonList}
  </ResponseStateCard>;

  return (
    <div
      className={cn(
        "survey-participation-notice flex flex-col gap-4 rounded-2xl border text-left",
        compact
          ? "mt-4 border-slate-200 bg-slate-50/80 p-4"
          : "w-full border-slate-200 bg-white p-8 text-center shadow-none",
      )}
    >
      <div className={cn("flex gap-3", !compact && "flex-col items-center text-center")}>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isLoginRequired
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          )}
        >
          {isLoginRequired ? (
            <LockKeyhole aria-hidden="true" className="size-5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-5" />
          )}
        </div>

        <div className={cn("min-w-0", !compact && "text-center")}>
          <h2 className="text-base font-semibold text-slate-900">
            {isLoginRequired
              ? lang === "ko"
                ? `로그인이 필요한 ${subject === "vote" ? "투표" : "설문"}입니다`
                : "Login required"
              : lang === "ko"
                ? "참여 자격을 충족하지 않습니다"
                : "You are not eligible to participate"}
          </h2>
          <p className="mt-1.5 text-sm font-normal leading-6 text-slate-600">
            {description ?? (isLoginRequired
              ? lang === "ko"
                ? `${subject === "vote" ? "투표" : "설문"} 참여 및 본인 확인을 위해 KAIST 계정으로 로그인해 주세요.`
                : `Sign in to check the participation requirements for this ${subject}.`
              : lang === "ko"
                ? "다음 조건을 충족하지 못해 응답할 수 없습니다."
                : "You cannot submit a response because these requirements are not met.")}
          </p>
        </div>
      </div>

      {reasonList}

      {isLoginRequired ? (
        <Button asChild size={compact ? "sm" : "default"} className={cn(!compact && "w-full")}>
          <Link to="/login" onClick={() => rememberAuthReturnPath()}>{lang === "ko" ? "로그인" : "Sign in"}</Link>
        </Button>
      ) : null}
    </div>
  );
}
