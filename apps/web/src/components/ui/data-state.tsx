import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DataStateProps {
  children?: ReactNode;
  className?: string;
  message: string;
  minHeightClassName?: string;
}

export function EmptyState({
  children,
  className,
  message,
  minHeightClassName = "min-h-36",
}: DataStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm font-bold text-slate-400",
        minHeightClassName,
        className,
      )}
    >
      {children ?? message}
    </div>
  );
}
