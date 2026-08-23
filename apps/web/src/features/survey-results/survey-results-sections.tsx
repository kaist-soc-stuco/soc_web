import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  QuestionType,
  SurveyAnalyticsResponse,
  SurveyChoiceAnalyticsItem,
  SurveyGridAnalytics,
  SurveyQuestionAnalyticsItem,
} from "@soc/contracts";
import {
  AlertCircle,
  Calendar,
  Clock,
  ListChecks,
  Lock,
  ShieldCheck,
  Users,
  Languages,
} from "lucide-react";

import { sortChoiceResults } from "@/lib/survey-results-display";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { formatSurveyPeriod } from "@/features/survey/survey-answer-utils";

import type { SurveyResultsError } from "./use-survey-results-page-controller";

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
    grid_single: { ko: "객관식 그리드", en: "Multiple choice grid" },
    grid_multiple: { ko: "체크박스 그리드", en: "Checkbox grid" },
    file_upload: { ko: "파일 업로드", en: "File upload" },
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
  if (state === "before_open") return lang === "ko" ? "시작 예정" : "Upcoming";
  return lang === "ko" ? "마감" : "Closed";
}

function isChoiceQuestion(type: QuestionType) {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "dropdown"
  );
}

function getScheduleLabel(analytics: SurveyAnalyticsResponse, lang: string) {
  return formatSurveyPeriod(analytics.opensAt, analytics.closesAt, lang);
}

function getAudienceLabel(analytics: SurveyAnalyticsResponse, lang: string) {
  if (analytics.feePayersOnly) {
    return lang === "ko" ? "과비 납부자" : "Paid members";
  }
  return lang === "ko" ? "로그인 필요" : "Login required";
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

function GridResult({ grid, lang }: { grid: SurveyGridAnalytics; lang: string }) {
  const cellByKey = new Map(
    grid.cells.map((cell) => [`${cell.rowValue}\u0000${cell.columnValue}`, cell]),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead className="bg-slate-50">
          <tr>
            <th className="h-11 border-b border-slate-200 px-3 text-xs font-normal text-[#344054]">항목</th>
            {grid.columns.map((column) => (
              <th key={column.value} className="h-11 border-b border-slate-200 px-3 text-center text-xs font-normal text-[#344054]">
                {getLocalizedTitle(lang, column.labelKo, column.labelEn)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.value} className="border-b border-slate-100 last:border-b-0">
              <th className="px-3 py-3 text-sm font-normal text-[#172033]">
                {getLocalizedTitle(lang, row.labelKo, row.labelEn)}
              </th>
              {grid.columns.map((column) => {
                const cell = cellByKey.get(`${row.value}\u0000${column.value}`);
                return (
                  <td key={column.value} className="px-3 py-3 text-center text-xs font-normal tabular-nums text-[#344054]">
                    {cell?.count ?? 0}{cell?.percentage ? ` (${cell.percentage}%)` : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrivateRawAnswerResult({
  question,
  lang,
}: {
  question: SurveyQuestionAnalyticsItem;
  lang: string;
}) {
  if (question.totalAnswers === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-400">
        {lang === "ko" ? "제출된 응답이 없습니다." : "No responses submitted."}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-kaist-darkgreen" />
      <p className="font-medium leading-relaxed">
        {lang === "ko"
          ? "개인정보 보호를 위해 이 문항의 개별 응답은 공개 결과에 표시하지 않습니다."
          : "Individual answers to this question are hidden from public results for privacy."}
      </p>
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
          <h2 className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[15px] font-medium leading-6 text-slate-950">
            <span className="inline-flex h-6 shrink-0 items-center leading-6 text-kaist-darkgreen">
              {idx + 1}.
            </span>
            <span className="min-h-6 break-words leading-6">{title}</span>
          </h2>
        </div>
      </div>

      {isChoiceQuestion(question.questionType) ? (
        <ChoiceResult choices={question.choices ?? []} lang={lang} />
      ) : question.grid ? (
        <GridResult grid={question.grid} lang={lang} />
      ) : (
        <PrivateRawAnswerResult question={question} lang={lang} />
      )}
    </ResultShell>
  );
}

export function SurveyResultsContent({
  analytics,
  error,
  lang,
  loading,
}: {
  analytics: SurveyAnalyticsResponse | null;
  error: SurveyResultsError;
  lang: string;
  loading: boolean;
}) {
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
        <h2 className="mb-3 text-2xl font-bold text-slate-950">
          {lang === "ko" ? "결과 비공개 설문" : "Private Survey Results"}
        </h2>
        <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
          {lang === "ko"
            ? "이 설문의 결과는 비공개로 설정되어 있습니다. 관리자 권한을 가진 사용자만 조회할 수 있습니다."
            : "This survey's results are private. Only administrators are allowed to view the analytics."}
        </p>
        <Link
          to="/surveys"
          className="inline-flex w-full items-center justify-center rounded-xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-white shadow-md shadow-kaist-darkgreen/15 transition hover:bg-kaist-darkgreen/90"
        >
          {lang === "ko" ? "설문 목록으로" : "Survey list"}
        </Link>
      </ResultShell>
    );
  }

  if (error || !analytics) {
    return (
      <ResultShell className="flex flex-col items-center gap-3 p-10 text-center text-sm font-semibold text-rose-500">
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
          <span className="inline-flex items-center gap-1.5 rounded-md border border-kaist-darkgreen/15 bg-kaist-lightgreen/20 px-3 py-1.5 text-xs font-semibold text-kaist-darkgreen">
            <ListChecks className="h-3.5 w-3.5 text-kaist-darkgreen" />
            {getSurveyKindLabel(analytics.kind, lang)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            {getStateLabel(analytics.computedState, lang)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Users className="h-3.5 w-3.5" />
            {lang === "ko"
              ? `총 응답 ${analytics.totalResponses}개`
              : `${analytics.totalResponses} total responses`}
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {getLocalizedTitle(lang, analytics.titleKo, analytics.titleEn)}
        </h1>
        {getLocalizedTitle(
          lang,
          analytics.descriptionKo ?? "",
          analytics.descriptionEn,
        ) && (
          <RichTextContent
            content={getLocalizedTitle(
              lang,
              analytics.descriptionKo ?? "",
              analytics.descriptionEn,
            )}
            className="mt-3 text-[15px] font-medium leading-relaxed text-slate-600"
          />
        )}
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-normal text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-kaist-darkgreen" />
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
          {analytics.isKoreanOnly && (
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-kaist-darkgreen" />
              {lang === "ko"
                ? "한국어 사용자만"
                : "Korean Speakers Only"}
            </span>
          )}
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
}
