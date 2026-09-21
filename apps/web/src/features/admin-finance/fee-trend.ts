import { isoToDate, msToDate } from "@soc/shared";
type ReceiptDay = { period: string; paidAmount: number; paymentCount: number };
export type FeeTrendPoint = { start: string; end: string; label: string; amount: number; count: number; cumulative: number };
const dayMs = 86_400_000;
const date = (value: string) => isoToDate(`${value}T00:00:00Z`);
const stamp = (value: Date) => value.toISOString().slice(0, 10);

/** Date-only arithmetic uses UTC; incoming dates already represent Korean receipt days. */
export function buildFeeTrend(rows: ReceiptDay[], from: string, to: string): { unit: string; points: FeeTrendPoint[] } {
  const first = from || rows.map(row => row.period).sort()[0] || to;
  const start = date(first), end = date(to);
  const days = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  if (!Number.isFinite(days) || days < 1) return { unit: "일", points: [] };
  const unit = days <= 45 ? "일" : days <= 180 ? "주" : "월";
  const points: FeeTrendPoint[] = [];
  const amounts = new Map(rows.map(row => [row.period, row]));
  let cumulative = 0;
  for (let cursor = msToDate(start.getTime()); cursor <= end;) {
    const bucketStart = msToDate(cursor.getTime());
    const next = msToDate(cursor.getTime());
    if (unit === "월") next.setUTCMonth(next.getUTCMonth() + 1, 1);
    else next.setUTCDate(next.getUTCDate() + (unit === "주" ? 7 : 1));
    const bucketEnd = msToDate(Math.min(next.getTime() - dayMs, end.getTime()));
    let amount = 0, count = 0;
    while (cursor <= bucketEnd) {
      const row = amounts.get(stamp(cursor));
      amount += row?.paidAmount ?? 0;
      count += row?.paymentCount ?? 0;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    cumulative += amount;
    const left = stamp(bucketStart), right = stamp(bucketEnd);
    const short = (s: string) => s.slice(first.slice(0, 4) === to.slice(0, 4) ? 5 : 0).replaceAll("-", ".");
    points.push({ start: left, end: right, amount, count, cumulative,
      label: unit === "월" ? left.slice(0, 7).replace("-", ".") : left === right ? short(left) : `${short(left)}–${short(right)}` });
  }
  return { unit, points };
}
