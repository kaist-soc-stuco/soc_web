import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Lock,
  UserCheck,
} from "lucide-react";

import { formatSurveyDateTime } from "./survey-answer-utils";

export function BeforeOpenView({
  opensAt,
  lang,
}: {
  opensAt: string | null;
  lang: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 border border-amber-100">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "설문 준비 중" : "Survey Preparing"}
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
            : `Scheduled to open: ${formatSurveyDateTime(opensAt)}`}
        </div>
      )}
    </div>
  );
}

export function ClosedView({ lang }: { lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
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

export function LoginRequiredView({
  lang,
  feePayersOnly,
}: {
  lang: string;
  feePayersOnly?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-kaist-lightgreen/20 flex items-center justify-center text-kaist-darkgreen mb-6 border border-kaist-lightgreen/30">
        <UserCheck className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "로그인이 필요합니다" : "Login Required"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {feePayersOnly
          ? lang === "ko"
            ? "이 설문은 과비 납부 회원만 응답할 수 있습니다. 로그인하여 납부 여부를 확인해 주세요."
            : "This survey is restricted to Paid Members Only. Please log in to verify your status."
          : lang === "ko"
            ? "이 설문조사에 참여하기 위해서는 로그인이 필요합니다."
            : "To participate in this survey, please log in to your account first."}
      </p>
      <a
        href="/login"
        className="w-full py-3 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 text-center text-sm"
      >
        {lang === "ko" ? "로그인 하러 가기" : "Go to Login"}
      </a>
    </div>
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
  lang,
  resultVisibility,
  surveyId,
}: {
  lang: string;
  resultVisibility: string;
  surveyId: string;
}) {
  const canViewResults = resultVisibility === "PUBLIC";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-[0_14px_45px_rgba(15,23,42,0.08)] text-center flex w-full flex-col items-center mx-auto my-10 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-14 h-14 rounded-2xl bg-kaist-lightgreen/20 flex items-center justify-center text-kaist-darkgreen mb-5 border border-kaist-lightgreen/30">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "제출이 완료되었습니다" : "Submission Completed"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {lang === "ko"
          ? "소중한 의견을 보내주셔서 감사합니다. 응답이 성공적으로 제출되었습니다."
          : "Thank you for sharing your thoughts. Your responses have been submitted successfully."}
      </p>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {canViewResults && (
          <Link
            to={`/survey/${surveyId}/results`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/surveys"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Survey list"}
        </Link>
      </div>
    </div>
  );
}

export function AlreadySubmittedView({
  lang,
  resultVisibility,
  surveyId,
}: {
  lang: string;
  resultVisibility: string;
  surveyId: string;
}) {
  const canViewResults = resultVisibility === "PUBLIC";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-[0_14px_45px_rgba(15,23,42,0.08)] text-center flex w-full flex-col items-center mx-auto my-10 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-5 border border-blue-100">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko" ? "이미 참여한 설문입니다" : "Already Participated"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {lang === "ko"
          ? canViewResults
            ? "이 설문조사는 1회만 응답할 수 있습니다. 공개된 결과를 확인하거나 다른 설문 목록으로 이동할 수 있습니다."
            : "이 설문조사는 1회만 응답할 수 있습니다. 결과는 비공개로 설정되어 있습니다."
          : canViewResults
            ? "You have already responded to this survey. You can view public results or return to the survey list."
            : "You have already responded to this survey. Results are private."}
      </p>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {canViewResults && (
          <Link
            to={`/survey/${surveyId}/results`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/surveys"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Survey list"}
        </Link>
      </div>
    </div>
  );
}
