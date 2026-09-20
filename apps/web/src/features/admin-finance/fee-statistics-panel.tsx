import { useMemo, useState } from "react";
import type { StudentFeeStatsResponse } from "@soc/contracts";
import { AdminCard } from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buildFeeTrend } from "./fee-trend";

type FeeSemesterOption = { value: string; label: string };
const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0 px-5 py-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-medium tabular-nums text-slate-900">{value}</p>{detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}</div>;
}

export function FeeStatisticsPanel({ semester, semesterOptions, loading, onSemesterChange, stats, range, onRangeChange }: {
  semester: string; semesterOptions: readonly FeeSemesterOption[]; loading: boolean;
  onSemesterChange: (value: string) => void; stats: StudentFeeStatsResponse | null;
  range: DateRange; onRangeChange: (range: DateRange) => void;
}) {
  const [mode, setMode] = useState<"period" | "cumulative">("period");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const chart = useMemo(() => buildFeeTrend(stats?.trend ?? [], range.from, range.to || today), [stats, range.from, range.to, today]);
  const totals = stats?.totals;
  const receiptStudents = stats?.trend.at(-1)?.cumulativeStudents ?? 0;
  const max = Math.max(1, ...chart.points.map(point => mode === "period" ? point.amount : point.cumulative));
  const ceiling = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const x = (index: number) => 92 + (index + .5) * 790 / Math.max(chart.points.length, 1);
  const y = (value: number) => 182 - value / ceiling * 154;
  return <div className="space-y-5" aria-busy={loading}>
    <AdminCard className="overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h2 className="text-base font-medium text-slate-900">학기별 납부 현황</h2><p className="mt-1 text-xs text-slate-500">선택 학기에 납부 혜택이 적용되는 회원 기준입니다.</p></div>
        <AdminSelectDropdown ariaLabel="납부 현황 기준 학기" value={semester} onChange={onSemesterChange} options={[...semesterOptions]} className="w-44" />
      </div>
      <div className={`grid divide-y divide-slate-100 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0 ${loading ? "opacity-60" : ""}`}>
        <Metric label="대상 인원" value={totals ? `${totals.totalStudents.toLocaleString()}명` : "—"} />
        <Metric label="납부 인정" value={totals ? `${totals.paidStudents.toLocaleString()}명` : "—"} detail={totals ? `납부 인정률 ${totals.paymentRate}%` : undefined} />
        <Metric label="부분 납부" value={totals ? `${totals.partialStudents.toLocaleString()}명` : "—"} />
        <Metric label="미납" value={totals ? `${totals.unpaidStudents.toLocaleString()}명` : "—"} />
      </div>
    </AdminCard>
    <AdminCard className="overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h2 className="text-base font-medium text-slate-900">기간별 수납 내역</h2><p className="mt-1 text-xs text-slate-500">학기와 관계없이 실제 수납일(한국 시간) 기준으로 집계합니다.</p></div>
        <DateRangePicker label="수납 기간" value={range} onChange={onRangeChange} disableFuture />
      </div>
      <div className={`grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 ${loading ? "opacity-60" : ""}`}>
        <Metric label="기간 내 수납액" value={totals ? money(totals.paidAmount) : "—"} />
        <Metric label="납부 인원" value={totals ? `${receiptStudents.toLocaleString()}명` : "—"} detail="중복 납부자를 제외한 인원" />
        <Metric label="납부 건수" value={totals ? `${totals.paymentCount.toLocaleString()}건` : "—"} />
      </div>
      <div className="border-t border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">수납 추이 <span className="ml-1 text-xs font-normal text-slate-500">{chart.unit} 단위</span></h3><SegmentedControl ariaLabel="수납 추이 표시" value={mode} onChange={setMode} options={[{value:"period",label:"기간별 금액"},{value:"cumulative",label:"누적 금액"}]} /></div>
        {!stats ? <div className="h-52" /> : !totals?.paymentCount ? <p className="flex h-52 items-center justify-center text-sm text-slate-500">선택한 기간에 수납 내역이 없습니다.</p> : <>
          <svg viewBox="0 0 920 222" className={`mt-3 h-56 w-full ${loading ? "opacity-60" : ""}`} role="img" aria-label={`${mode === "period" ? "기간별" : "누적"} 수납 금액 추이`}>
            {[0,.5,1].map(ratio => <g key={ratio}><line x1="92" x2="895" y1={y(ceiling*ratio)} y2={y(ceiling*ratio)} stroke="#e2e8f0" /><text x="82" y={y(ceiling*ratio)+4} textAnchor="end" fontSize="12" fill="#64748b">{money(ceiling*ratio)}</text></g>)}
            {mode === "cumulative" ? <polyline fill="none" stroke="#047857" strokeWidth="2" points={chart.points.map((point,i)=>`${x(i)},${y(point.cumulative)}`).join(" ")} /> : null}
            {chart.points.map((point,i) => <g key={point.start}>
              {mode === "period" ? <rect x={x(i)-Math.min(14,300/chart.points.length)} y={y(point.amount)} width={Math.min(28,600/chart.points.length)} height={182-y(point.amount)} rx="2" fill="#76b49c"><title>{point.label}: {money(point.amount)} · {point.count}건</title></rect> : <circle cx={x(i)} cy={y(point.cumulative)} r="2.5" fill="#047857"><title>{point.label}: 누적 {money(point.cumulative)}</title></circle>}
              {i % Math.max(1,Math.ceil(chart.points.length/6)) === 0 || i === chart.points.length-1 ? <text x={x(i)} y="207" textAnchor="middle" fontSize="11" fill="#64748b">{point.label}</text> : null}
            </g>)}
          </svg>
          <p className="text-xs text-slate-500">{mode === "cumulative" ? "선택한 기간의 시작일부터 누적한 금액입니다." : "수납이 없는 구간은 0원으로 표시합니다."}</p>
          <details className="mt-4 text-sm"><summary className="w-fit cursor-pointer text-slate-600">집계 내역 보기</summary><table className="mt-3 w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="py-2 font-medium">기간</th><th className="text-right font-medium">수납액</th><th className="text-right font-medium">건수</th><th className="text-right font-medium">누적액</th></tr></thead><tbody>{chart.points.map(point=><tr key={point.start} className="border-b border-slate-100"><td className="py-2">{point.start} ~ {point.end}</td><td className="text-right tabular-nums">{money(point.amount)}</td><td className="text-right tabular-nums">{point.count}</td><td className="text-right tabular-nums">{money(point.cumulative)}</td></tr>)}</tbody></table></details>
        </>}
      </div>
    </AdminCard>
  </div>;
}
export type { FeeSemesterOption };
