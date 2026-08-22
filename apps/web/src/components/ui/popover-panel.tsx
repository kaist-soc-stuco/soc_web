import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function PopoverPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "absolute z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated",
        className,
      )}
      {...props}
    />
  );
}
