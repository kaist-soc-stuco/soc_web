import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type StatusChipTone = 'healthy' | 'degraded' | 'neutral';

const toneClasses: Record<StatusChipTone, string> = {
  healthy: 'border-emerald-300 bg-emerald-100/80 text-emerald-900',
  degraded: 'border-rose-300 bg-rose-100/80 text-rose-900',
  neutral: 'border-slate-300 bg-slate-100/80 text-slate-700',
};

interface StatusChipProps {
  tone?: StatusChipTone;
  children: ReactNode;
}

export function StatusChip({ tone = 'neutral', children }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
