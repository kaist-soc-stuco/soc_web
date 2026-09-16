import type { StudentFeeStatsResponse } from "@soc/contracts";

import { AdminCard, AdminEmptyState } from "@/components/ui/admin-page";
import { SegmentedControl } from "@/components/ui/segmented-control";

type FeeSemesterOption = { value: string; label: string };

const formatCurrency = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const compactCurrency = (value: number) => value >= 100_000_000 ? `${Math.round(value / 10_000_000) / 10}억원` : value >= 10_000 ? `${Math.round(value / 1_000) / 10}만원` : `${value.toLocaleString("ko-KR")}원`;

function FeeTrendChart({ data }: { data: StudentFeeStatsResponse["trend"] }) {
  if (data.length === 0) return <AdminEmptyState message="선택한 학기에 등록된 납부 내역이 없습니다." className="py-20" />;
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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[680px] w-full" role="img" aria-label="선택 학기의 납부 금액과 누적 금액 추이">
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
      <div className="mt-2 flex justify-end gap-4 text-xs font-normal text-[#344054]"><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#a9cfbf]" />선택 학기 납부액</span><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[#176b51]" />누적 납부액</span></div>
    </div>
  );
}

export function FeeStatisticsPanel({
  semester,
  semesterOptions,
  loading,
  onSemesterChange,
  stats,
}: {
  semester: string;
  semesterOptions: readonly FeeSemesterOption[];
  loading: boolean;
  onSemesterChange: (value: string) => void;
  stats: StudentFeeStatsResponse | null;
}) {
  const totals = stats?.totals ?? {
    totalStudents: 0,
    paidStudents: 0,
    partialStudents: 0,
    unpaidStudents: 0,
    paymentRate: 0,
    paidAmount: 0,
    collectedAmount: 0,
    targetAmount: 0,
    outstandingAmount: 0,
  };
  const collectedAmount = totals.collectedAmount ?? totals.paidAmount;

  return (
    <div className="space-y-4">
      <AdminCard className="flex min-w-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0"><p className="text-xs font-medium text-slate-500">조회 기준 학기</p><p className="mt-1 text-sm font-medium text-slate-900">원장과 수납 현황을 학기별로 확인합니다.</p></div>
        <div className="min-w-0 max-w-full overflow-x-auto"><SegmentedControl<string> ariaLabel="납부 통계 학기" value={semester} onChange={onSemesterChange} className="w-max min-w-full" options={semesterOptions} /></div>
      </AdminCard>

      {!stats ? <div aria-busy="true" className="min-h-20" /> : <AdminCard className={loading ? "overflow-hidden opacity-60 transition-opacity" : "overflow-hidden"}>
        <div className="grid divide-y divide-[#e5eaf0] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="px-5 py-4"><p className="text-xs font-normal text-[#344054]">총 수납액</p><p className="mt-1.5 text-lg font-medium tabular-nums text-[#172033]">{formatCurrency(collectedAmount)}</p><p className="mt-1 text-xs font-normal tabular-nums text-slate-500">목표 {formatCurrency(totals.targetAmount)} · 미수금 {formatCurrency(totals.outstandingAmount)}</p></div>
          <div className="px-5 py-4"><p className="text-xs font-normal text-[#344054]">완납</p><p className="mt-1.5 text-lg font-medium tabular-nums text-[#172033]">{totals.paidStudents.toLocaleString("ko-KR")}명 <span className="text-sm font-normal text-slate-500">/ {totals.totalStudents.toLocaleString("ko-KR")}명</span></p><p className="mt-1 text-xs font-normal tabular-nums text-slate-500">완납률 {totals.paymentRate}%</p></div>
          <div className="px-5 py-4"><p className="text-xs font-normal text-[#344054]">부분 납부</p><p className="mt-1.5 text-lg font-medium tabular-nums text-[#172033]">{totals.partialStudents.toLocaleString("ko-KR")}명</p><p className="mt-1 text-xs font-normal tabular-nums text-slate-500">미납 {totals.unpaidStudents.toLocaleString("ko-KR")}명</p></div>
        </div>
        <div className="border-t border-[#e5eaf0] p-5"><div className="mb-5"><h2 className="text-[length:var(--ui-text-section-size)] font-medium text-[var(--ui-text-strong)]">선택 학기 납부 추이</h2></div><FeeTrendChart data={stats.trend} /></div>
      </AdminCard>}
    </div>
  );
}

export type { FeeSemesterOption };
