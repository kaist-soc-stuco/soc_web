import type {
  SurveyParticipationEligibility,
  SurveyParticipationEligibilityReason,
} from "@soc/contracts";
import { CircleAlert, LogIn, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SurveyParticipationNoticeProps {
  eligibility: SurveyParticipationEligibility;
  lang: string;
  compact?: boolean;
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
    ko: "과비 납부가 확인되지 않았습니다.",
    en: "Your student-fee payment could not be verified.",
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
}: SurveyParticipationNoticeProps) {
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

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border text-left",
        compact
          ? "mt-4 border-slate-200 bg-slate-50/80 p-4"
          : "mx-auto my-10 w-full max-w-md border-slate-200 bg-white p-8 text-center shadow-[0_6px_20px_rgba(15,23,42,0.04)]",
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
            <LogIn aria-hidden="true" className="size-5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-5" />
          )}
        </div>

        <div className={cn("min-w-0", !compact && "text-center")}>
          <h2 className="text-base font-semibold text-slate-900">
            {isLoginRequired
              ? lang === "ko"
                ? "로그인이 필요합니다"
                : "Login required"
              : lang === "ko"
                ? "참여 자격을 충족하지 않습니다"
                : "You are not eligible to participate"}
          </h2>
          <p className="mt-1.5 text-sm font-normal leading-6 text-slate-600">
            {isLoginRequired
              ? lang === "ko"
                ? "로그인하면 이 설문에 설정된 참여 조건을 확인할 수 있습니다."
                : "Sign in to check the participation requirements for this survey."
              : lang === "ko"
                ? "다음 조건을 충족하지 못해 응답할 수 없습니다."
                : "You cannot submit a response because these requirements are not met."}
          </p>
        </div>
      </div>

      {!isLoginRequired && reasons.length > 0 ? (
        <ul className="space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-normal leading-5 text-amber-900">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{getReasonLabel(reason, lang)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isLoginRequired ? (
        <Button asChild size={compact ? "sm" : "default"} className={cn(!compact && "w-full")}>
          <Link to="/login">{lang === "ko" ? "로그인" : "Sign in"}</Link>
        </Button>
      ) : null}
    </div>
  );
}
