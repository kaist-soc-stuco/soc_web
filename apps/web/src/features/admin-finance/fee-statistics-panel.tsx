import type { StudentFeeStatsResponse } from "@soc/contracts";

import { AdminCard, AdminEmptyState } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { Skeleton } from "@/components/ui/skeleton";

type PeriodPreset = "30d" | "90d" | "year" | "custom";

const formatCurrency = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const compactCurrency = (value: number) => value >= 100_000_000 ? `${Math.round(value / 10_000_000) / 10}억원` : value >= 10_000 ? `${Math.round(value / 1_000) / 10}만원` : `${value.toLocaleString("ko-KR")}원`;

function FeeTrendChart({ data }: { data: StudentFeeStatsResponse["trend"] }) {
  if (data.length === 0) return <AdminEmptyState message="선택한 기간에 등록된 납부 내역이 없습니다." className="py-20" />;
  const width = 900;
  const height = 250;
  const left = 46;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maximum = Math.max(1, ...data.map((item) => item.cumulativeAmount));
  const step = chartWidth / data.length;
  const x = (index: number) => left + step * index + step / 2;
  const y = (value: number) => top + chartHeight - (value / maximum) * chartHeight;
  const points = data.map((item, index) => `${x(index)},${y(item.cumulativeAmount)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[680px] w-full" role="img" aria-label="기간별 납부 금액과 누적 금액 추이">
        {[0, 0.5, 1].map((ratio) => {
          const gridY = top + chartHeight * ratio;
          const value = maximum * (1 - ratio);
          return <g key={ratio}><line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="#e5eaf0" strokeWidth="1" /><text x={left - 8} y={gridY + 4} textAnchor="end" fill="#344054" fontSize="10" fontWeight="400">{compactCurrency(value)}</text></g>;
        })}
        {data.map((item, index) => {
          const barHeight = (item.paidAmount / maximum) * chartHeight;
          return <g key={item.period}><rect x={x(index) - Math.min(18, step * 0.32)} y={top + chartHeight - barHeight} width={Math.min(36, step * 0.64)} height={Math.max(2, barHeight)} rx="3" fill="#a9cfbf"><title>{`${item.period} · ${formatCurrency(item.paidAmount)} · ${item.paymentCount}건`}</title></rect>{index % labelEvery === 0 || index === data.length - 1 ? <text x={x(index)} y={height - 15} textAnchor="middle" fill="#344054" fontSize="10" fontWeight="400">{item.period.replace(/^\d{4}-/, "")}</text> : null}</g>;
        })}
        <polyline points={points} fill="none" stroke="#176b51" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((item, index) => <circle key={`${item.period}-point`} cx={x(index)} cy={y(item.cumulativeAmount)} r="2.5" fill="#176b51"><title>{`${item.period} 누적 · ${formatCurrency(item.cumulativeAmount)}`}</title></circle>)}
      </svg>
      <div className="mt-2 flex justify-end gap-4 text-xs font-normal text-[#344054]"><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#a9cfbf]" />기간 납부액</span><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[#176b51]" />누적 납부액</span></div>
    </div>
  );
}

export function FeeStatisticsPanel({
  dateFrom,
  dateTo,
  loading,
  onDateFromChange,
  onDateToChange,
  onPresetChange,
  preset,
  stats,
}: {
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onPresetChange: (value: PeriodPreset) => void;
  preset: PeriodPreset;
  stats: StudentFeeStatsResponse | null;
}) {
  return (
    <div className="space-y-4">
      <AdminCard className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {([[
            "30d", "최근 30일"], ["90d", "최근 90일"], ["year", "올해"], ["custom", "직접 선택"]] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={preset === value ? "secondary" : "ghost"} className="!font-normal" onClick={() => onPresetChange(value)}>{label}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UiInput aria-label="조회 시작일" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.currentTarget.value)} className="w-40" />
          <span className="text-xs font-normal text-[#344054]">—</span>
          <UiInput aria-label="조회 종료일" type="date" value={dateTo} onChange={(event) => onDateToChange(event.currentTarget.value)} className="w-40" />
        </div>
      </AdminCard>

      {loading || !stats ? <div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}</div> : <AdminCard className="grid divide-y divide-[#e5eaf0] md:grid-cols-4 md:divide-x md:divide-y-0">{[
        ["납부 금액", formatCurrency(stats.totals.paidAmount)],
        ["납부 건수", `${stats.totals.paymentCount.toLocaleString("ko-KR")}건`],
        ["납부 학생", `${stats.totals.paidStudentCount.toLocaleString("ko-KR")}명`],
        ["납부 학생 비율", `${stats.totals.paymentRate}%`],
      ].map(([label, value]) => <div key={label} className="px-5 py-4"><p className="text-xs font-normal text-[#344054]">{label}</p><p className="mt-1.5 text-lg font-medium tabular-nums text-[#172033]">{value}</p></div>)}</AdminCard>}

      <AdminCard className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-[15px] font-medium text-[#172033]">기간별 납부 추이</h2><span className="text-xs font-normal text-[#344054]">납부 원장 기준</span></div>
        {loading || !stats ? <Skeleton className="h-64 rounded-lg" /> : <FeeTrendChart data={stats.trend} />}
      </AdminCard>

      {!loading && stats && stats.majorBreakdown.length > 0 ? <AdminCard className="overflow-hidden"><div className="border-b border-[#e5eaf0] px-5 py-4"><h2 className="text-[15px] font-medium text-[#172033]">전공 구분별 현황</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-[#f8fafc] text-xs font-normal text-[#344054]"><tr><th className="px-5 py-3 text-left font-normal">구분</th><th className="px-5 py-3 text-right font-normal">대상</th><th className="px-5 py-3 text-right font-normal">납부 학생</th><th className="px-5 py-3 text-right font-normal">비율</th><th className="px-5 py-3 text-right font-normal">납부 금액</th></tr></thead><tbody className="divide-y divide-[#edf1f4]">{stats.majorBreakdown.map((item) => <tr key={item.category}><td className="px-5 py-3 font-normal text-[#172033]">{item.label}</td><td className="px-5 py-3 text-right font-normal tabular-nums text-[#344054]">{item.totalStudents}명</td><td className="px-5 py-3 text-right font-normal tabular-nums text-[#172033]">{item.paidStudents}명</td><td className="px-5 py-3 text-right font-normal tabular-nums text-[#344054]">{item.paymentRate}%</td><td className="px-5 py-3 text-right font-normal tabular-nums text-[#172033]">{formatCurrency(item.paidAmount)}</td></tr>)}</tbody></table></div></AdminCard> : null}
    </div>
  );
}

export type { PeriodPreset };
