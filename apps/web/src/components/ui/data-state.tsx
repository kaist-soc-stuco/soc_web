import type { ReactNode } from "react";
import { FileText } from "lucide-react";

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
        "select-none flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm font-medium text-slate-400",
        minHeightClassName,
        className,
      )}
    >
      <FileText aria-hidden="true" className="h-5 w-5 text-slate-300" strokeWidth={1.6} />
      <span>{children ?? message}</span>
    </div>
  );
}
