import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type AdminStatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

const toneClassNames: Record<AdminStatusTone, string> = {
  neutral: "border-slate-200 bg-white text-[#344054]",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-slate-200 bg-white text-[#344054]",
};

export function AdminStatusBadge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: AdminStatusTone }) {
  return (
    <span
      className={cn(
        "select-none inline-flex h-6 max-w-full items-center whitespace-nowrap rounded-md border px-2 text-xs font-normal",
        toneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}
