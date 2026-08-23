import { useMemo } from "react";
import type {
  SurveyAnalyticsResponse,
  SurveyQuestionAnalyticsItem,
  SurveyQuestionRecord,
  SurveyResponseWithAnswers,
} from "@soc/contracts";
import { isoToDate, isoToMs, msToIso, nowIso } from "@soc/shared";

import { AdminCard, AdminEmptyState } from "@/components/ui/admin-page";
import { formatSurveyAnswer } from "@/lib/survey-answer-display";

const DAY_MS = 24 * 60 * 60 * 1_000;

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function shortDate(value: Date) {
  return `${value.getMonth() + 1}.${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = isoToDate(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildDailyTrend(responses: SurveyResponseWithAnswers[], days = 14) {
  const end = isoToDate(nowIso());
  end.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  responses.forEach((response) => {
    if (!response.submittedAt) return;
    const key = dateKey(isoToDate(response.submittedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from({ length: days }, (_, index) => {
    const date = isoToDate(msToIso(end.getTime() - (days - index - 1) * DAY_MS));
    return { key: dateKey(date), label: shortDate(date), count: counts.get(dateKey(date)) ?? 0 };
  });
}

function KpiStrip({ responses, analytics }: { responses: SurveyResponseWithAnswers[]; analytics: SurveyAnalyticsResponse }) {
  const today = dateKey(isoToDate(nowIso()));
  const todayCount = responses.filter((response) => response.submittedAt && dateKey(isoToDate(response.submittedAt)) === today).length;
  const latest = responses
    .filter((response) => response.submittedAt)
    .sort((a, b) => isoToMs(b.submittedAt!) - isoToMs(a.submittedAt!))[0]?.submittedAt;
  const stateLabel = analytics.computedState === "open" ? "응답 접수 중" : analytics.computedState === "before_open" ? "시작 전" : "종료";
  const items = [
    ["전체 응답", `${analytics.totalResponses.toLocaleString("ko-KR")}건`],
    ["오늘 응답", `${todayCount.toLocaleString("ko-KR")}건`],
    ["최근 응답", formatDateTime(latest)],
    ["설문 상태", stateLabel],
  ];

  return (
    <AdminCard className="grid divide-y divide-[#e5eaf0] md:grid-cols-4 md:divide-x md:divide-y-0">
      {items.map(([label, value]) => (
        <div key={label} className="px-5 py-4">
          <p className="text-xs font-normal text-[#344054]">{label}</p>
          <p className="mt-1.5 text-lg font-medium tabular-nums text-[#172033]">{value}</p>
        </div>
      ))}
    </AdminCard>
  );
}

function ResponseTrend({ responses }: { responses: SurveyResponseWithAnswers[] }) {
  const trend = useMemo(() => buildDailyTrend(responses), [responses]);
  const maximum = Math.max(1, ...trend.map((item) => item.count));

  return (
    <AdminCard className="p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[length:var(--ui-text-section-size)] font-medium text-[#172033]">최근 14일 응답 추이</h2>
        <span className="text-xs font-normal text-[#344054]">제출 완료 기준</span>
      </div>
      <div className="grid h-52 items-end gap-2 border-b border-[#e5eaf0] px-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {trend.map((item, index) => (
          <div key={item.key} className="flex h-full min-w-0 flex-col justify-end gap-2" title={`${item.label} · ${item.count}건`}>
            <span className="text-center text-[length:var(--ui-text-caption-size)] font-normal tabular-nums text-[#344054]">{item.count || ""}</span>
            <div className="mx-auto w-full max-w-8 rounded-t bg-[#75b69d]" style={{ height: `${Math.max(item.count > 0 ? 8 : 2, (item.count / maximum) * 128)}px`, opacity: item.count > 0 ? 1 : 0.2 }} />
            <span className="truncate pb-2 text-center text-[length:var(--ui-text-micro-size)] font-normal tabular-nums text-[#344054]">{index % 2 === 0 || index === trend.length - 1 ? item.label : ""}</span>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}

export function SurveyResponseSummary({ analytics, responses }: { analytics: SurveyAnalyticsResponse; responses: SurveyResponseWithAnswers[] }) {
  return <div className="space-y-4"><KpiStrip analytics={analytics} responses={responses} /><ResponseTrend responses={responses} /></div>;
}

function ChoiceBreakdown({ question }: { question: SurveyQuestionAnalyticsItem }) {
  const choices = question.choices ?? [];
  const maximum = Math.max(1, ...choices.map((choice) => choice.count));
  return (
    <div className="space-y-3">
      {choices.map((choice) => (
        <div key={choice.value} className="grid grid-cols-[minmax(120px,1fr)_minmax(180px,2fr)_96px] items-center gap-3 text-sm">
          <span className="truncate font-normal text-[#172033]">{choice.labelKo}</span>
          <div className="h-2 overflow-hidden rounded-full bg-[#edf1f4]"><div className="h-full rounded-full bg-[#75b69d]" style={{ width: `${(choice.count / maximum) * 100}%` }} /></div>
          <span className="text-right text-xs font-normal tabular-nums text-[#344054]">{choice.count}건 · {choice.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

function GridBreakdown({ question }: { question: SurveyQuestionAnalyticsItem }) {
  const grid = question.grid;
  if (!grid) return null;
  const cellMap = new Map(grid.cells.map((cell) => [`${cell.rowValue}\u0000${cell.columnValue}`, cell]));
  const maximum = Math.max(1, ...grid.cells.map((cell) => cell.count));
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e5eaf0]">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead className="bg-[#f8fafc]"><tr><th className="px-3 py-2.5 text-left text-xs font-normal text-[#344054]">항목</th>{grid.columns.map((column) => <th key={column.value} className="px-3 py-2.5 text-center text-xs font-normal text-[#344054]">{column.labelKo}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#edf1f4]">{grid.rows.map((row) => <tr key={row.value}><th className="px-3 py-3 text-left font-normal text-[#172033]">{row.labelKo}</th>{grid.columns.map((column) => { const cell = cellMap.get(`${row.value}\u0000${column.value}`); const intensity = (cell?.count ?? 0) / maximum; return <td key={column.value} className="px-3 py-3 text-center font-normal tabular-nums text-[#172033]" style={{ backgroundColor: `rgba(117, 182, 157, ${0.06 + intensity * 0.24})` }}>{cell?.count ?? 0}<span className="ml-1 text-xs text-[#344054]">({cell?.percentage ?? 0}%)</span></td>; })}</tr>)}</tbody>
      </table>
    </div>
  );
}

function RawAnswers({ question, responses }: { question: SurveyQuestionRecord; responses: SurveyResponseWithAnswers[] }) {
  const values = responses.map((response) => formatSurveyAnswer(response.answers.find((answer) => answer.questionId === question.id), question)).filter((value) => value && value !== "—");
  if (values.length === 0) return <AdminEmptyState message="제출된 답변이 없습니다." className="py-8" />;
  return <div className="max-h-72 divide-y divide-[#edf1f4] overflow-y-auto rounded-lg border border-[#e5eaf0]">{values.map((value, index) => <p key={`${index}-${value}`} className="px-4 py-3 text-sm font-normal leading-6 text-[#172033]">{value}</p>)}</div>;
}

export function SurveyQuestionSummary({ analytics, questions, responses }: { analytics: SurveyAnalyticsResponse; questions: SurveyQuestionRecord[]; responses: SurveyResponseWithAnswers[] }) {
  if (questions.length === 0) return <AdminCard><AdminEmptyState message="등록된 문항이 없습니다." /></AdminCard>;
  const analyticsByQuestion = new Map(analytics.questions.map((question) => [question.questionId, question]));
  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const result = analyticsByQuestion.get(question.id);
        return (
          <AdminCard key={question.id} className="p-5">
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#edf1f4] pb-4">
              <div className="min-w-0"><p className="text-xs font-normal text-[#344054]">문항 {index + 1}</p><h2 className="mt-1 text-[length:var(--ui-text-section-size)] font-semibold leading-6 text-[#172033]">{question.titleKo}</h2></div>
              <span className="shrink-0 text-xs font-normal tabular-nums text-[#344054]">응답 {result?.totalAnswers ?? 0}건</span>
            </div>
            {result?.choices ? <ChoiceBreakdown question={result} /> : result?.grid ? <GridBreakdown question={result} /> : <RawAnswers question={question} responses={responses} />}
          </AdminCard>
        );
      })}
    </div>
  );
}
