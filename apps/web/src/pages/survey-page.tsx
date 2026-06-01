import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type {
  SurveyAnswerRecord,
  SurveyDetailResponse,
  SurveyQuestionRecord,
  QuestionType,
  QuestionOption,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import {
  Check,
  Clock,
  Calendar,
  Lock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";

// ─── 질문별 입력 컴포넌트 ────────────────────────────────────────────────────

type AnswerValue = string | string[];

interface QuestionInputProps {
  question: SurveyQuestionRecord;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  lang: string;
  disabled?: boolean;
}

function QuestionInput({
  question,
  value,
  onChange,
  lang,
  disabled = false,
}: QuestionInputProps) {
  const base =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300";

  const getOptionLabel = (opt: QuestionOption) => {
    return lang === "ko" ? opt.labelKo : opt.labelEn || opt.labelKo;
  };

  switch (question.questionType as QuestionType) {
    case "short_text":
      return (
        <input
          className={base}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
          placeholder={
            lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
          }
        />
      );

    case "long_text":
      return (
        <textarea
          className={`${base} min-h-[100px] resize-y`}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
          placeholder={
            lang === "ko" ? "답변을 입력하세요" : "Enter your answer"
          }
        />
      );

    case "single_choice":
    case "dropdown":
      if (question.questionType === "dropdown") {
        return (
          <select
            className={base}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={question.isRequired}
            disabled={disabled}
          >
            <option value="">
              {lang === "ko" ? "선택하세요" : "Select an option"}
            </option>
            {question.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {getOptionLabel(opt)}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-kaist-darkgreen bg-white"
                      : "border-kaist-grey/30"
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-kaist-darkgreen" />
                  )}
                </div>
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => onChange(opt.value)}
                  disabled={disabled}
                  className="hidden"
                />
                <span className="text-sm leading-none">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
        </div>
      );

    case "multiple_choice":
      return (
        <div className="flex flex-col gap-2.5">
          {question.options?.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  selected
                    ? "border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5"
                    : "border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selected
                      ? "border-kaist-darkgreen bg-kaist-darkgreen"
                      : "border-kaist-grey/30"
                  }`}
                >
                  {selected && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={selected}
                  onChange={() => {
                    if (disabled) return;
                    const prev = value as string[];
                    onChange(
                      selected
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value],
                    );
                  }}
                  disabled={disabled}
                  className="hidden"
                />
                <span className="text-sm leading-none">
                  {getOptionLabel(opt)}
                </span>
              </label>
            );
          })}
        </div>
      );

    case "date":
      return (
        <input
          className={base}
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
      );

    case "time":
      return (
        <input
          className={base}
          type="time"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
      );

    case "datetime":
      return (
        <input
          className={base}
          type="datetime-local"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          disabled={disabled}
        />
      );

    default:
      return (
        <p className="text-sm text-red-500">
          {lang === "ko"
            ? "지원하지 않는 질문 형식입니다."
            : "Unsupported question type."}
        </p>
      );
  }
}

// ─── 답변 → API content 변환 ─────────────────────────────────────────────────

function toAnswerContent(
  type: QuestionType,
  value: AnswerValue,
): Record<string, unknown> {
  switch (type) {
    case "short_text":
    case "long_text":
      return { text: value as string };
    case "single_choice":
    case "dropdown":
      return { value: value as string };
    case "multiple_choice":
      return { values: value as string[] };
    case "date":
      return { date: value as string };
    case "time":
      return { time: value as string };
    case "datetime":
      return { datetime: value as string };
    default:
      return { value };
  }
}

function answerContentToValue(
  type: QuestionType,
  answer: SurveyAnswerRecord | undefined,
): AnswerValue {
  if (!answer) return type === "multiple_choice" ? [] : "";
  const content = answer.content;

  if (type === "multiple_choice") {
    return Array.isArray(content.values)
      ? content.values.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  }
  if (type === "short_text" || type === "long_text") {
    return typeof content.text === "string" ? content.text : "";
  }
  if (type === "single_choice" || type === "dropdown") {
    return typeof content.value === "string" ? content.value : "";
  }
  if (type === "date")
    return typeof content.date === "string" ? content.date : "";
  if (type === "time")
    return typeof content.time === "string" ? content.time : "";
  if (type === "datetime") {
    return typeof content.datetime === "string" ? content.datetime : "";
  }
  return "";
}

function formatSurveyDateTime(iso: string) {
  const date = isoToDate(iso);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function getLocalizedText(
  lang: string,
  ko: string | null | undefined,
  en: string | null | undefined,
) {
  return lang === "ko" ? (ko ?? "") : en || ko || "";
}

function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "APPLICATION") {
    return lang === "ko" ? "신청서/행사 접수" : "Event application";
  }
  return lang === "ko" ? "일반 설문" : "Survey";
}

function getAudienceLabel(survey: SurveyDetailResponse, lang: string) {
  if (survey.feePayersOnly) {
    return lang === "ko" ? "과비 납부자" : "Paid members";
  }
  if (survey.isKoreanOnly) {
    return lang === "ko" ? "한국어 사용자" : "Korean-language users";
  }
  return lang === "ko" ? "로그인 회원" : "Signed-in members";
}

function getResponsePolicyLabel(survey: SurveyDetailResponse, lang: string) {
  const countPolicy = survey.allowMultipleResponses
    ? lang === "ko"
      ? "복수 응답 가능"
      : "Multiple submissions allowed"
    : lang === "ko"
      ? "1회만 응답 가능"
      : "One submission per user";
  const resultPolicy =
    survey.resultVisibility === "PUBLIC"
      ? lang === "ko"
        ? "결과 공개"
        : "Public results"
      : lang === "ko"
        ? "결과 비공개"
        : "Private results";

  return `${countPolicy} · ${resultPolicy}`;
}

function getScheduleLabel(survey: SurveyDetailResponse, lang: string) {
  if (!survey.opensAt && !survey.closesAt) {
    return lang === "ko" ? "상시 응답 가능" : "Always open";
  }

  const opensAt = survey.opensAt ? formatSurveyDateTime(survey.opensAt) : null;
  const closesAt = survey.closesAt
    ? formatSurveyDateTime(survey.closesAt)
    : null;

  if (opensAt && closesAt) {
    return lang === "ko"
      ? `${opensAt} ~ ${closesAt}`
      : `${opensAt} - ${closesAt}`;
  }
  if (opensAt) return lang === "ko" ? `${opensAt}부터` : `From ${opensAt}`;
  return lang === "ko" ? `${closesAt}까지` : `Until ${closesAt}`;
}

function isAnswerFilled(type: QuestionType, value: AnswerValue | undefined) {
  if (type === "multiple_choice") {
    return Array.isArray(value) && value.length > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
}

// ─── 상태별 화면 ─────────────────────────────────────────────────────────────

function BeforeOpenView({
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

function ClosedView({ lang }: { lang: string }) {
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

function LoginRequiredView({
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

function PreviewNoticeView({ lang }: { lang: string }) {
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

function KoreanOnlyWarningView({ lang }: { lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-100">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === "ko"
          ? "한국어 사용자 전용 설문"
          : "Korean-language survey only"}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-4">
        {lang === "ko"
          ? "이 설문은 한국어 사용자만 응답할 수 있도록 제한되어 있습니다."
          : "This survey is restricted to Korean-language users."}
      </p>
    </div>
  );
}

function SuccessView({
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
      <h2 className="text-2xl font-black text-kaist-black mb-3">
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/events-surveys?tab=survey"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-800 transition hover:bg-slate-100"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Survey list"}
        </Link>
      </div>
    </div>
  );
}

function AlreadySubmittedView({
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
      <h2 className="text-2xl font-black text-kaist-black mb-3">
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
          >
            <FileText className="h-4 w-4" />
            {lang === "ko" ? "결과 보기" : "View results"}
          </Link>
        )}
        <Link
          to="/events-surveys?tab=survey"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-800 transition hover:bg-slate-100"
        >
          <ListChecks className="h-4 w-4" />
          {lang === "ko" ? "설문 목록으로" : "Survey list"}
        </Link>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  const allQuestions = useMemo(
    () => survey?.sections.flatMap((section) => section.questions) ?? [],
    [survey],
  );

  const requiredQuestions = useMemo(
    () => allQuestions.filter((question) => question.isRequired),
    [allQuestions],
  );

  useEffect(() => {
    if (!id) return;

    apiClient
      .getSurveyDetail(id)
      .then((data) => {
        setSurvey(data);
        const answerByQuestionId = new Map(
          data.currentResponse?.answers.map((answer) => [
            answer.questionId,
            answer,
          ]) ?? [],
        );
        const init: Record<string, AnswerValue> = {};
        for (const section of data.sections) {
          for (const q of section.questions) {
            init[q.id] = answerContentToValue(
              q.questionType,
              answerByQuestionId.get(q.id),
            );
          }
        }
        setAnswers(init);
      })
      .catch(() =>
        setLoadError(
          lang === "ko"
            ? "설문을 불러오지 못했습니다."
            : "Failed to load survey.",
        ),
      );
  }, [id, apiClient, lang]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!survey || !id) return;
    setSubmitting(true);
    setSubmitError(null);
    if (survey.isPreview || !survey.isPublished) {
      setSubmitError(
        lang === "ko"
          ? "공개되지 않은 설문은 제출할 수 없습니다."
          : "Unpublished surveys cannot be submitted.",
      );
      setSubmitting(false);
      return;
    }

    const missingRequired = requiredQuestions.filter(
      (question) =>
        !isAnswerFilled(question.questionType, answers[question.id]),
    );
    if (missingRequired.length > 0) {
      setSubmitError(
        lang === "ko"
          ? "필수 문항에 모두 응답한 뒤 제출해 주세요."
          : "Please answer all required questions before submitting.",
      );
      setSubmitting(false);
      return;
    }

    const answerInputs = allQuestions.map((q) => ({
      questionId: q.id,
      content: toAnswerContent(q.questionType, answers[q.id] ?? ""),
    }));

    try {
      const shouldUpdateExistingResponse =
        Boolean(survey.currentResponse) &&
        survey.allowResponseEdit &&
        !survey.allowMultipleResponses;

      if (shouldUpdateExistingResponse) {
        await apiClient.updateMySurveyResponse(id, { answers: answerInputs });
      } else {
        await apiClient.submitSurveyResponse(id, { answers: answerInputs });
      }
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiClientHttpError && error.status === 403) {
        setSubmitError(
          lang === "ko"
            ? "응답 권한 또는 참여 조건을 충족하지 못했습니다."
            : "You do not meet the response requirements.",
        );
      } else if (error instanceof ApiClientHttpError && error.status === 409) {
        setSubmitError(
          lang === "ko"
            ? "이미 마감되었거나 응답할 수 없는 설문입니다."
            : "This survey is closed or cannot accept responses.",
        );
      } else {
        setSubmitError(
          lang === "ko"
            ? "제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
            : "An error occurred during submission. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-red-500 font-bold shadow-xl">
          {loadError}
        </div>
      );
    }
    if (!survey || sessionLoading) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-kaist-grey/60 font-medium shadow-xl">
          {lang === "ko" ? "불러오는 중..." : "Loading..."}
        </div>
      );
    }
    if (submitted) {
      return (
        <SuccessView
          lang={lang}
          resultVisibility={survey.resultVisibility}
          surveyId={id!}
        />
      );
    }
    const isPreview = Boolean(survey.isPreview || !survey.isPublished);
    if (!isPreview && survey.computedState === "before_open")
      return <BeforeOpenView opensAt={survey.opensAt} lang={lang} />;
    if (!isPreview && survey.computedState === "closed")
      return <ClosedView lang={lang} />;

    const sessionAuthenticated = Boolean(
      session?.authenticated && session.canUsePersistentFeatures,
    );

    if (!isPreview && !sessionAuthenticated) {
      return (
        <LoginRequiredView lang={lang} feePayersOnly={survey.feePayersOnly} />
      );
    }

    if (
      !isPreview &&
      survey.hasSubmitted &&
      !survey.allowMultipleResponses &&
      !survey.allowResponseEdit
    ) {
      return (
        <AlreadySubmittedView
          lang={lang}
          resultVisibility={survey.resultVisibility}
          surveyId={id!}
        />
      );
    }

    if (
      !isPreview &&
      survey.isKoreanOnly &&
      session?.nameKo &&
      session?.nameEn &&
      session.nameKo === session.nameEn
    ) {
      return <KoreanOnlyWarningView lang={lang} />;
    }

    const isEditingExistingResponse =
      Boolean(survey.currentResponse) &&
      survey.allowResponseEdit &&
      !survey.allowMultipleResponses;

    return (
      <div className="animate-in fade-in slide-in-from-top-4 duration-300">
        {isPreview && <PreviewNoticeView lang={lang} />}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isEditingExistingResponse && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {lang === "ko"
                ? "이전에 제출한 응답을 수정하는 중입니다. 마감 전까지 다시 저장할 수 있습니다."
                : "You are editing your previous response. Changes can be saved before the survey closes."}
            </div>
          )}
          {survey.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-4">
              {((lang === "ko"
                ? section.titleKo
                : section.titleEn || section.titleKo) ||
                (lang === "ko"
                  ? section.descriptionKo
                  : section.descriptionEn || section.descriptionKo)) && (
                <div className="px-1 pb-1 pt-2">
                  {(lang === "ko"
                    ? section.titleKo
                    : section.titleEn || section.titleKo) && (
                    <h2 className="text-base font-extrabold text-slate-950">
                      {lang === "ko"
                        ? section.titleKo
                        : section.titleEn || section.titleKo}
                    </h2>
                  )}
                  {(lang === "ko"
                    ? section.descriptionKo
                    : section.descriptionEn || section.descriptionKo) && (
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">
                      {lang === "ko"
                        ? section.descriptionKo
                        : section.descriptionEn || section.descriptionKo}
                    </p>
                  )}
                </div>
              )}

              {section.questions.map((question) => {
                const questionIndex =
                  allQuestions.findIndex((item) => item.id === question.id) + 1;

                return (
                  <div
                    key={question.id}
                    className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_35px_rgba(15,23,42,0.05)] transition-all hover:border-kaist-darkgreen/20 hover:shadow-[0_16px_40px_rgba(15,23,42,0.07)]"
                  >
                    <div className="mb-3.5 border-b border-slate-100 pb-3">
                      <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[15px] font-extrabold leading-6 text-slate-950">
                        <span className="inline-flex h-6 shrink-0 items-center leading-6 text-kaist-darkgreen">
                          {questionIndex}.
                        </span>
                        <span className="min-h-6 break-words leading-6">
                          {lang === "ko"
                            ? question.titleKo
                            : question.titleEn || question.titleKo}
                          {question.isRequired && (
                            <span className="ml-1 inline-block translate-y-[-0.22em] text-xs font-black leading-none text-rose-500">
                              *
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                    {(lang === "ko"
                      ? question.descriptionKo
                      : question.descriptionEn || question.descriptionKo) && (
                      <p className="mb-4 text-sm font-medium leading-relaxed text-slate-500">
                        {lang === "ko"
                          ? question.descriptionKo
                          : question.descriptionEn || question.descriptionKo}
                      </p>
                    )}
                    <div>
                      <QuestionInput
                        question={question}
                        value={
                          answers[question.id] ??
                          (question.questionType === "multiple_choice"
                            ? []
                            : "")
                        }
                        onChange={(v) =>
                          setAnswers((prev) => ({ ...prev, [question.id]: v }))
                        }
                        lang={lang}
                        disabled={isPreview}
                      />
                    </div>
                  </div>
                );
              })}
            </section>
          ))}

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold">
              {submitError}
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={submitting || isPreview}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-kaist-darkgreen px-8 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-kaist-darkgreen/15 transition-all hover:bg-kaist-darkgreen/90 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {lang === "ko" ? "제출 중..." : "Submitting..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  {isEditingExistingResponse
                    ? lang === "ko"
                      ? "수정 내용 저장하기"
                      : "Save changes"
                    : lang === "ko"
                      ? "설문 응답 제출하기"
                      : "Submit Response"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <Header showLogo />
      <main className="flex-1 px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-[52rem]">
          {survey && (
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-top-4 duration-300 sm:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-kaist-darkgreen/15 bg-kaist-lightgreen/20 px-3 py-1.5 text-xs font-extrabold text-kaist-darkgreen">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {getSurveyKindLabel(survey.kind, lang)}
                </span>
                {survey.closesAt && survey.computedState === "open" && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {lang === "ko"
                      ? `진행 중 (~${formatSurveyDateTime(survey.closesAt)})`
                      : `Open (closes: ${formatSurveyDateTime(survey.closesAt)})`}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {getLocalizedText(lang, survey.titleKo, survey.titleEn)}
              </h1>
              {getLocalizedText(
                lang,
                survey.descriptionKo,
                survey.descriptionEn,
              ) && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                  {getLocalizedText(
                    lang,
                    survey.descriptionKo,
                    survey.descriptionEn,
                  )}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-kaist-darkgreen" />
                  {lang === "ko" ? "대상" : "Audience"}:{" "}
                  {getAudienceLabel(survey, lang)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-kaist-darkgreen" />
                  {getResponsePolicyLabel(survey, lang)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-kaist-darkgreen" />
                  {getScheduleLabel(survey, lang)}
                </span>
              </div>
            </section>
          )}
          {renderBody()}
        </div>
      </main>
    </div>
  );
}
