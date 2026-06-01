import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type {
  QuestionType,
  SurveyAnalyticsResponse,
  SurveyChoiceAnalyticsItem,
  SurveyQuestionAnalyticsItem,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  getVisibleTextResponses,
  sortChoiceResults,
} from "@/lib/survey-results-display";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  Clock,
  ListChecks,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";

const CHART_COLORS = ["#047857", "#059669", "#10B981", "#34D399"];

function getLocalizedTitle(
  lang: string,
  ko: string,
  en: string | null | undefined,
) {
  return lang === "ko" ? ko : en || ko;
}

function getQuestionTypeLabel(type: QuestionType, lang: string) {
  const labels: Record<QuestionType, { ko: string; en: string }> = {
    short_text: { ko: "단답형", en: "Short text" },
    long_text: { ko: "서술형", en: "Long text" },
    single_choice: { ko: "단일 선택", en: "Single choice" },
    multiple_choice: { ko: "복수 선택", en: "Multiple choice" },
    dropdown: { ko: "드롭다운", en: "Dropdown" },
    date: { ko: "날짜", en: "Date" },
    time: { ko: "시간", en: "Time" },
    datetime: { ko: "날짜와 시간", en: "Date & time" },
  };

  return lang === "ko" ? labels[type].ko : labels[type].en;
}

function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "APPLICATION") {
    return lang === "ko" ? "신청서/행사 접수" : "Event application";
  }
  return lang === "ko" ? "일반 설문" : "Survey";
}

function getStateLabel(state: string, lang: string) {
  if (state === "open") return lang === "ko" ? "진행 중" : "Open";
  if (state === "before_open") return lang === "ko" ? "시작 전" : "Upcoming";
  return lang === "ko" ? "마감" : "Closed";
}

function isChoiceQuestion(type: QuestionType) {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "dropdown"
  );
}

function isTemporalQuestion(type: QuestionType) {
  return type === "date" || type === "time" || type === "datetime";
}

function formatTemporalAnswer(type: QuestionType, value: string) {
  if (!value) return "";
  if (type === "time") return value;

  const parsed = isoToDate(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const dateText = `${yyyy}.${mm}.${dd}`;
  if (type !== "datetime") return dateText;

  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${dateText} ${hh}:${min}`;
}

function formatSurveyDateTime(iso: string) {
  const parsed = isoToDate(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function getScheduleLabel(analytics: SurveyAnalyticsResponse, lang: string) {
  if (!analytics.opensAt && !analytics.closesAt) {
    return lang === "ko" ? "상시 응답 가능" : "Always open";
  }

  const opensAt = analytics.opensAt
    ? formatSurveyDateTime(analytics.opensAt)
    : null;
  const closesAt = analytics.closesAt
    ? formatSurveyDateTime(analytics.closesAt)
    : null;

  if (opensAt && closesAt) {
    return lang === "ko"
      ? `${opensAt} ~ ${closesAt}`
      : `${opensAt} - ${closesAt}`;
  }
  if (opensAt) return lang === "ko" ? `${opensAt}부터` : `From ${opensAt}`;
  return lang === "ko" ? `${closesAt}까지` : `Until ${closesAt}`;
}

function getAudienceLabel(analytics: SurveyAnalyticsResponse, lang: string) {
  if (analytics.feePayersOnly) {
    return lang === "ko" ? "과비 납부자" : "Paid members";
  }
  if (analytics.isKoreanOnly) {
    return lang === "ko" ? "한국어 사용자" : "Korean-language users";
  }
  return lang === "ko" ? "로그인 회원" : "Signed-in members";
}

function getResponsePolicyLabel(
  analytics: SurveyAnalyticsResponse,
  lang: string,
) {
  const countPolicy = analytics.allowMultipleResponses
    ? lang === "ko"
      ? "복수 응답 가능"
      : "Multiple submissions allowed"
    : lang === "ko"
      ? "1회만 응답 가능"
      : "One submission per user";
  const resultPolicy =
    analytics.resultVisibility === "PUBLIC"
      ? lang === "ko"
        ? "결과 공개"
        : "Public results"
      : lang === "ko"
        ? "결과 비공개"
        : "Private results";

  return `${countPolicy} · ${resultPolicy}`;
}

function ResultShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function ChoiceResult({
  choices,
  lang,
}: {
  choices: SurveyChoiceAnalyticsItem[];
  lang: string;
}) {
  const sortedChoices = sortChoiceResults(choices);

  return (
    <div className="space-y-2.5">
      {sortedChoices.map((choice, idx) => {
        const label = getLocalizedTitle(lang, choice.labelKo, choice.labelEn);
        const color = CHART_COLORS[idx % CHART_COLORS.length];

        return (
          <div key={choice.value} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-slate-700">
                {label}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-500">
                {lang === "ko"
                  ? `${choice.count}명 (${choice.percentage}%)`
                  : `${choice.count} (${choice.percentage}%)`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${choice.percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TextResult({
  texts,
  lang,
  type,
}: {
  texts: string[] | undefined;
  lang: string;
  type: QuestionType;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!texts?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
        {lang === "ko" ? "제출된 답변이 없습니다." : "No responses submitted."}
      </div>
    );
  }

  const isShortText = type === "short_text";
  const { hiddenCount, visibleTexts } = getVisibleTextResponses(
    texts,
    type,
    expanded,
  );

  return (
    <div className={isShortText ? "space-y-1.5" : "space-y-2.5"}>
      {visibleTexts.map((text, idx) => (
        <div
          key={`${idx}-${text}`}
          className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-2 ${
            isShortText ? "items-center" : "items-start"
          }`}
        >
          <span className="pt-0.5 text-right text-xs font-bold tabular-nums text-slate-400">
            {idx + 1}.
          </span>
          <p
            className={
              isShortText
                ? "min-w-0 truncate text-sm font-medium text-slate-700"
                : "min-w-0 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-700"
            }
          >
            {text || (
              <span className="text-slate-400">
                {lang === "ko" ? "빈 응답" : "Empty response"}
              </span>
            )}
          </p>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-kaist-darkgreen"
        >
          {lang === "ko"
            ? `${hiddenCount}개 더 보기`
            : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function TemporalResult({
  question,
  lang,
}: {
  question: SurveyQuestionAnalyticsItem;
  lang: string;
}) {
  const values = question.texts ?? [];
  const Icon = question.questionType === "time" ? Clock : Calendar;

  if (!values.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
        {lang === "ko"
          ? "제출된 날짜/시간 응답이 없습니다."
          : "No date or time responses submitted."}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {values.map((value, idx) => (
        <div
          key={`${idx}-${value}`}
          className="flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          <Icon className="h-4 w-4 text-kaist-darkgreen" />
          {formatTemporalAnswer(question.questionType, value)}
        </div>
      ))}
    </div>
  );
}

function QuestionResultCard({
  idx,
  lang,
  question,
}: {
  idx: number;
  lang: string;
  question: SurveyQuestionAnalyticsItem;
}) {
  const title = getLocalizedTitle(lang, question.titleKo, question.titleEn);

  return (
    <ResultShell className="px-5 py-4">
      <div className="mb-3.5 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-md bg-kaist-lightgreen/20 px-1.5 py-0.5 text-[10px] font-bold text-kaist-darkgreen">
              {getQuestionTypeLabel(question.questionType, lang)}
            </span>
            <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {lang === "ko"
                ? `응답 ${question.totalAnswers}개`
                : `${question.totalAnswers} answers`}
            </span>
          </div>
          <h2 className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[15px] font-extrabold leading-6 text-slate-950">
            <span className="inline-flex h-6 shrink-0 items-center leading-6 text-kaist-darkgreen">
              {idx + 1}.
            </span>
            <span className="min-h-6 break-words leading-6">{title}</span>
          </h2>
        </div>
      </div>

      {isChoiceQuestion(question.questionType) ? (
        <ChoiceResult choices={question.choices ?? []} lang={lang} />
      ) : isTemporalQuestion(question.questionType) ? (
        <TemporalResult question={question} lang={lang} />
      ) : (
        <TextResult
          texts={question.texts}
          lang={lang}
          type={question.questionType}
        />
      )}
    </ResultShell>
  );
}

export function SurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const [analytics, setAnalytics] = useState<SurveyAnalyticsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .getSurveyAnalytics(id)
      .then((data) => {
        setAnalytics(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientHttpError && err.status === 403) {
          setError("forbidden");
        } else {
          setError("failed");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, apiClient]);

  const renderContent = () => {
    if (loading) {
      return (
        <ResultShell className="p-10 text-center text-sm font-bold text-slate-400">
          {lang === "ko" ? "결과를 불러오는 중..." : "Loading results..."}
        </ResultShell>
      );
    }

    if (error === "forbidden") {
      return (
        <ResultShell className="mx-auto my-10 flex max-w-md flex-col items-center p-8 text-center sm:p-10">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-500">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="mb-3 text-2xl font-black text-slate-950">
            {lang === "ko" ? "결과 비공개 설문" : "Private Survey Results"}
          </h2>
          <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
            {lang === "ko"
              ? "이 설문의 결과는 비공개로 설정되어 있습니다. 관리자 권한을 가진 사용자만 조회할 수 있습니다."
              : "This survey's results are private. Only administrators are allowed to view the analytics."}
          </p>
          <Link
            to="/events-surveys?tab=survey"
            className="inline-flex w-full items-center justify-center rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
          >
            {lang === "ko" ? "설문 목록으로" : "Survey list"}
          </Link>
        </ResultShell>
      );
    }

    if (error || !analytics) {
      return (
        <ResultShell className="flex flex-col items-center gap-3 p-10 text-center text-sm font-extrabold text-rose-500">
          <AlertCircle className="h-10 w-10" />
          <span>
            {lang === "ko"
              ? "결과 데이터를 조회하지 못했습니다."
              : "Failed to load survey results."}
          </span>
        </ResultShell>
      );
    }

    return (
      <div className="space-y-5">
        <ResultShell className="p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-kaist-darkgreen/15 bg-kaist-lightgreen/20 px-3 py-1.5 text-xs font-extrabold text-kaist-darkgreen">
              <ListChecks className="h-3.5 w-3.5 text-kaist-darkgreen" />
              {getSurveyKindLabel(analytics.kind, lang)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              {getStateLabel(analytics.computedState, lang)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700">
              <Users className="h-3.5 w-3.5" />
              {lang === "ko"
                ? `총 응답 ${analytics.totalResponses}개`
                : `${analytics.totalResponses} total responses`}
            </span>
          </div>

          <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
            {getLocalizedTitle(lang, analytics.titleKo, analytics.titleEn)}
          </h1>
          {getLocalizedTitle(
            lang,
            analytics.descriptionKo ?? "",
            analytics.descriptionEn,
          ) && (
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
              {getLocalizedTitle(
                lang,
                analytics.descriptionKo ?? "",
                analytics.descriptionEn,
              )}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-kaist-darkgreen" />
              {lang === "ko" ? "대상" : "Audience"}:{" "}
              {getAudienceLabel(analytics, lang)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-kaist-darkgreen" />
              {getResponsePolicyLabel(analytics, lang)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-kaist-darkgreen" />
              {getScheduleLabel(analytics, lang)}
            </span>
          </div>
        </ResultShell>

        {analytics.questions.map((question, idx) => (
          <QuestionResultCard
            key={question.questionId}
            idx={idx}
            lang={lang}
            question={question}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <Header showLogo />
      <main className="flex-1 px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-[52rem]">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent text-xs font-extrabold text-slate-400 transition-colors hover:text-kaist-darkgreen"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {lang === "ko" ? "이전 페이지로" : "Go back"}
            </button>
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
