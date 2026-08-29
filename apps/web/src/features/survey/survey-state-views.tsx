import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Lock,
} from "lucide-react";

import { formatSurveyDateTime } from "./survey-answer-utils";
import { SurveyParticipationNotice } from "./survey-participation-notice";

function ResponseRecordedNotice({
  lang,
  submittedAt,
}: {
  lang: string;
  submittedAt?: string | null;
}) {
  if (!submittedAt) return null;

  return (
    <p className="mb-8 text-sm font-normal text-slate-500">
      {formatSurveyDateTime(submittedAt)}{" "}
      {lang === "ko"
        ? "응답이 정상 기록되었습니다."
        : "Your response was recorded successfully."}
    </p>
  );
}

export function BeforeOpenView({
  opensAt,
  lang,
}: {
  opensAt: string | null;
  lang: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-md text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 border border-amber-100">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "설문 준비 중" : "Not open yet"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-6">
        {lang === "ko"
          ? "이 설문은 아직 시작되지 않았습니다. 시작 시각 이후에 참여해 주세요."
          : "This survey has not started yet. Please check back after the opening time."}
      </p>
      {opensAt && (
        <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl px-4 py-3 text-xs text-amber-700 font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          {lang === "ko"
            ? `시작 예정: ${formatSurveyDateTime(opensAt)}`
            : `Opens ${formatSurveyDateTime(opensAt)}`}
        </div>
      )}
    </div>
  );
}

export function ClosedView({
  embedded = false,
  lang,
}: {
  embedded?: boolean;
  lang: string;
}) {
  return (
    <div
      className={`${
        embedded
          ? "flex flex-col items-center text-center"
          : "mx-auto my-12 flex max-w-md flex-col items-center rounded-3xl border border-kaist-grey/15 bg-white p-12 text-center shadow-md"
      } animate-in fade-in zoom-in-95 duration-300`}
    >
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-100">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "마감된 설문입니다" : "Survey is Closed"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed">
        {lang === "ko"
          ? "이 설문의 응답 기간이 만료되어 더 이상 응답을 제출할 수 없습니다."
          : "The response period for this survey has ended, and submissions are no longer accepted."}
      </p>
    </div>
  );
}

export function LoginRequiredView({ lang }: { lang: string }) {
  return (
    <SurveyParticipationNotice
      eligibility={{ status: "LOGIN_REQUIRED", reasons: ["LOGIN_REQUIRED"] }}
      lang={lang}
    />
  );
}

export function PreviewNoticeView({ lang }: { lang: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
      <p>
        {lang === "ko"
          ? "관리자 미리보기입니다. 아직 공개되지 않은 설문이며 실제 응답 제출은 비활성화되어 있습니다."
          : "Admin preview. This survey is not published yet, so submitting responses is disabled."}
      </p>
    </div>
  );
}

export function SuccessView({
  embedded = false,
  lang,
  resultVisibility,
  surveyId,
  submittedAt,
}: {
  embedded?: boolean;
  lang: string;
  resultVisibility: string;
  surveyId: string;
  submittedAt?: string | null;
}) {
  const canViewResults = resultVisibility === "PUBLIC";

  return (
    <div
      className={`${
        embedded
          ? "flex w-full flex-col items-center text-center"
          : "mx-auto my-10 flex w-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_6px_20px_rgba(15,23,42,0.05)] sm:p-10"
      } animate-in fade-in zoom-in-95 duration-300`}
    >
      <div className="w-14 h-14 rounded-2xl bg-kaist-lightgreen/20 flex items-center justify-center text-kaist-darkgreen mb-5 border border-kaist-lightgreen/30">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "제출이 완료되었습니다" : "Response submitted"}
      </h2>
      <p className="mb-3 text-sm leading-relaxed text-kaist-grey/80">
        {lang === "ko"
          ? "소중한 의견을 보내주셔서 감사합니다. 응답이 성공적으로 제출되었습니다."
          : "Thank you for sharing your thoughts. Your responses have been submitted successfully."}
      </p>
      <ResponseRecordedNotice lang={lang} submittedAt={submittedAt} />
      <div className="flex w-full flex-wrap justify-center gap-2">
        {canViewResults && (
          <Link
            to={`/survey/${surveyId}/results`}
            className="select-none inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-kaist-darkgreen/10 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/surveys"
          className="select-none inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-medium text-white shadow-sm shadow-kaist-darkgreen/10 transition hover:bg-kaist-darkgreen/90"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Back to surveys"}
        </Link>
      </div>
    </div>
  );
}

export function AlreadySubmittedView({
  embedded = false,
  lang,
  resultVisibility,
  surveyId,
  submittedAt,
}: {
  embedded?: boolean;
  lang: string;
  resultVisibility: string;
  surveyId: string;
  submittedAt?: string | null;
}) {
  const canViewResults = resultVisibility === "PUBLIC";

  return (
    <div
      className={`${
        embedded
          ? "flex w-full flex-col items-center text-center"
          : "mx-auto my-10 flex w-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_6px_20px_rgba(15,23,42,0.05)] sm:p-10"
      } animate-in fade-in zoom-in-95 duration-300`}
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-5 border border-blue-100">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "이미 참여한 설문입니다" : "Already responded"}
      </h2>
      <p className="mb-3 text-sm leading-relaxed text-kaist-grey/80">
        {lang === "ko"
          ? canViewResults
            ? "이 설문조사는 1회만 응답할 수 있습니다. 공개된 결과를 확인하거나 다른 설문 목록으로 이동할 수 있습니다."
            : "이 설문조사는 1회만 응답할 수 있습니다. 결과는 비공개로 설정되어 있습니다."
          : canViewResults
            ? "You have already responded to this survey. You can view public results or return to the survey list."
            : "You have already responded to this survey. Results are private."}
      </p>
      <ResponseRecordedNotice lang={lang} submittedAt={submittedAt} />
      <div className="flex w-full flex-wrap justify-center gap-2">
        {canViewResults && (
          <Link
            to={`/survey/${surveyId}/results`}
            className="select-none inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-kaist-darkgreen/10 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/surveys"
          className="select-none inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-medium text-white shadow-sm shadow-kaist-darkgreen/10 transition hover:bg-kaist-darkgreen/90"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Back to surveys"}
        </Link>
      </div>
    </div>
  );
}
