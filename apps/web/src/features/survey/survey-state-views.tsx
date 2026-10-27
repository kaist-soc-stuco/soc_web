import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { isoToDate } from "@soc/shared";
import { Button } from "@/components/ui/button";
import { formatSurveyDateTime } from "./survey-answer-utils";
import { SurveyParticipationNotice } from "./survey-participation-notice";
import { ResponseStateCard, responseStateActionClassName } from "./response-state-card";
import { SurveyListAction } from "./response-layout";

export function BeforeOpenView({ opensAt, lang }: { opensAt: string | null; lang: string }) {
  const date = opensAt ? isoToDate(opensAt) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
  const start = validDate ? lang === "ko"
    ? `${validDate.getFullYear()}년 ${validDate.getMonth() + 1}월 ${validDate.getDate()}일 ${String(validDate.getHours()).padStart(2, "0")}:${String(validDate.getMinutes()).padStart(2, "0")}`
    : new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(validDate)
    : null;
  return <ResponseStateCard icon={Clock} tone="warning" mobileAction={<SurveyListAction lang={lang} />}
    title={lang === "ko" ? "아직 시작되지 않은 설문입니다" : "This survey has not started yet"}
    description={start
      ? lang === "ko" ? `${start}부터 참여할 수 있습니다.` : `You can participate from ${start}.`
      : lang === "ko" ? "설문이 시작되면 참여할 수 있습니다." : "You can participate once the survey opens."}
  />;
}

export function ClosedView({ embedded = false, lang, subject = "survey" }: { embedded?: boolean; lang: string; subject?: "survey" | "vote" }) {
  return <ResponseStateCard embedded={embedded} icon={Lock} mobileAction={!embedded && subject === "survey" ? <SurveyListAction lang={lang} /> : undefined}
    title={lang === "ko" ? `마감된 ${subject === "vote" ? "투표" : "설문"}입니다` : `This ${subject} has ended`}
    description={lang === "ko" ? "참여 기간이 종료되어 더 이상 참여할 수 없습니다." : "The participation period has ended. No further submissions are accepted."}
  />;
}

export function LoginRequiredView({ lang }: { lang: string }) {
  return <SurveyParticipationNotice eligibility={{ status: "LOGIN_REQUIRED", reasons: ["LOGIN_REQUIRED"] }} lang={lang} />;
}

export function PreviewNoticeView({ lang }: { lang: string }) {
  return <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
    <p>{lang === "ko" ? "관리자 미리보기입니다. 아직 공개되지 않은 설문이며 실제 응답 제출은 비활성화되어 있습니다." : "Admin preview. This survey is not published yet, so submitting responses is disabled."}</p>
  </div>;
}

export function SuccessView({ embedded = false, lang, resultVisibility, surveyId }: {
  embedded?: boolean; lang: string; resultVisibility: string; surveyId: string;
}) {
  return <ResponseStateCard embedded={embedded} icon={CheckCircle2} tone="success"
    title={lang === "ko" ? "제출이 완료되었습니다" : "Response submitted"}
    description={lang === "ko" ? "소중한 의견을 보내주셔서 감사합니다." : "Thank you for sharing your thoughts."}
    actions={resultVisibility === "PUBLIC" ? <Button asChild className={responseStateActionClassName}>
      <Link to={`/survey/${surveyId}/results`}>{lang === "ko" ? "결과 보기" : "View results"}</Link>
    </Button> : undefined}
    mobileAction={!embedded && resultVisibility !== "PUBLIC" ? <SurveyListAction lang={lang} /> : undefined}
  />;
}

export function AlreadySubmittedView({ embedded = false, lang, resultVisibility, surveyId, submittedAt }: {
  embedded?: boolean; lang: string; resultVisibility: string; surveyId: string; submittedAt?: string | null;
}) {
  const canViewResults = resultVisibility === "PUBLIC";
  return <ResponseStateCard className="survey-already-submitted" embedded={embedded} icon={CheckCircle2} tone="success"
    title={lang === "ko" ? "이미 참여한 설문입니다" : "You have already responded"}
    description={lang === "ko"
      ? canViewResults ? "한 번만 참여할 수 있는 설문입니다." : "한 번만 참여할 수 있는 설문입니다. 결과는 비공개입니다."
      : canViewResults ? "This survey accepts one response per person." : "This survey accepts one response per person. Results are private."}
    actions={canViewResults ? <Button asChild className={responseStateActionClassName}>
      <Link to={`/survey/${surveyId}/results`}>{lang === "ko" ? "결과 보기" : "View results"}</Link>
    </Button> : undefined}
    mobileAction={!embedded && !canViewResults ? <SurveyListAction lang={lang} /> : undefined}
  >
    {submittedAt ? <p className="text-sm font-normal leading-6 text-slate-500">{formatSurveyDateTime(submittedAt)} · {lang === "ko" ? "응답 기록됨" : "Response recorded"}</p> : null}
  </ResponseStateCard>;
}
