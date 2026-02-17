import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface MetricRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function MetricRow({ label, value, className }: MetricRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-lg border bg-background/70 px-3 py-2', className)}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <div className="max-w-[65%] text-right text-sm font-medium break-all">{value}</div>
    </div>
  );
}
