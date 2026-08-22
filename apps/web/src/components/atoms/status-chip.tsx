import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';

export type StatusChipTone = 'healthy' | 'degraded' | 'neutral';

const badgeTones: Record<StatusChipTone, 'success' | 'danger' | 'neutral'> = {
  healthy: 'success',
  degraded: 'danger',
  neutral: 'neutral',
};

interface StatusChipProps {
  tone?: StatusChipTone;
  children: ReactNode;
}

export function StatusChip({ tone = 'neutral', children }: StatusChipProps) {
  return (
    <Badge tone={badgeTones[tone]} className="uppercase tracking-wide">
      {children}
    </Badge>
  );
}
