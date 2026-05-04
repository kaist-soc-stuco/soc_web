import { useEffect, useRef, useState } from 'react';
import { nowMs, msToTimeObj, msToIso, type TimeObj } from '@soc/shared';

export interface UseTimeResult {
  ms: number;
  time: TimeObj;
  iso: string;
}

export function useTime(intervalMs = 60_000, tz = 'Asia/Seoul'): UseTimeResult {
  const [ms, setMs] = useState<number>(() => nowMs());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setMs(nowMs()), intervalMs);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [intervalMs]);

  return { ms, time: msToTimeObj(ms, tz), iso: msToIso(ms) };
}
