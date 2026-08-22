import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type AdminStatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

const toneClassNames: Record<AdminStatusTone, string> = {
  neutral: "border-slate-200 bg-white text-[#344054]",
  positive: "border-slate-200 bg-white text-[#344054]",
  warning: "border-slate-200 bg-white text-[#344054]",
  danger: "border-slate-200 bg-white text-[#344054]",
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
        "inline-flex h-6 max-w-full items-center whitespace-nowrap rounded-md border px-2 text-xs font-normal",
        toneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}
